import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query, execute, runInTransaction } from "../../shared/db";
import { HttpError } from "../../shared/httpError";
import { insertNotification } from "../../shared/notifications";
import { isUuid } from "../../shared/validation";

// Flat bonus paid to both the referrer and the referred client, at the
// referral's target salon, the first time the referred client visits there -
// matches the "you both earn... when they book" copy on ReferralScreen.
const REFERRAL_BONUS = 50;

export async function logVisit(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!ownerId) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let clientEmail: unknown;
  let amountSpent: unknown;
  let serviceId: unknown;
  let appointmentId: unknown;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    clientEmail = body.clientEmail;
    amountSpent = body.amountSpent;
    serviceId = body.serviceId;
    appointmentId = body.appointmentId;
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  if (typeof clientEmail !== "string" || !clientEmail.includes("@")) {
    throw new HttpError(400, "Missing or invalid clientEmail");
  }
  if (typeof amountSpent !== "number" || amountSpent <= 0) {
    throw new HttpError(400, "amountSpent must be a positive number");
  }
  if (serviceId !== undefined && serviceId !== null && !isUuid(serviceId)) {
    throw new HttpError(400, "serviceId must be a valid id");
  }
  if (appointmentId !== undefined && appointmentId !== null && !isUuid(appointmentId)) {
    throw new HttpError(400, "appointmentId must be a valid id");
  }

  // Scoping by "does this caller own a salon" is the authorization check
  // here - a client account owns no salon, so this rejects them before any
  // points could be awarded, the same pattern redeemReward.ts uses for its
  // own client-side scoping.
  const salonRows = await query(
    `SELECT id, name, reward_multiplier FROM salons WHERE owner_user_id = :ownerId::uuid`,
    { ownerId }
  );
  const salon = salonRows[0];
  if (!salon) {
    throw new HttpError(403, "Only salon owners can log visits");
  }
  const salonId = salon.id as string;
  const salonName = salon.name as string;
  const rewardMultiplier = Number(salon.reward_multiplier);

  const clientRows = await query(
    `SELECT id FROM users WHERE email = :clientEmail AND role = 'client'`,
    { clientEmail }
  );
  const client = clientRows[0];
  if (!client) {
    throw new HttpError(404, "No client found with that email");
  }
  const clientId = client.id as string;

  // Linking to a specific pre-paid (pay_now) appointment means points were
  // already awarded the moment that appointment was paid for (see
  // createAppointment in appointments.ts) - logging the visit it fulfills
  // must NOT award points again. A DB-level unique index on
  // visits.appointment_id also blocks the same appointment ever being
  // linked to two visits, as a hard backstop beyond this check.
  let linkedAppointment: Record<string, unknown> | undefined;
  if (appointmentId) {
    const apptRows = await query(
      `SELECT id, points_awarded FROM appointments
       WHERE id = :appointmentId::uuid AND client_id = :clientId::uuid AND salon_id = :salonId::uuid`,
      { appointmentId, clientId, salonId }
    );
    linkedAppointment = apptRows[0];
    if (!linkedAppointment) throw new HttpError(404, "Appointment not found for this client");

    const alreadyLogged = await query(`SELECT id FROM visits WHERE appointment_id = :appointmentId::uuid`, {
      appointmentId,
    });
    if (alreadyLogged[0]) throw new HttpError(400, "This appointment has already been logged as a visit");
  }

  // A picked service earns its own fixed points_value (set by the owner in
  // Services Management) instead of the old flat dollar-based formula -
  // lets different services be worth different amounts, e.g. a haircut vs a
  // full color. Falls back to the dollar formula only if no service is
  // picked, for backward compatibility with salons that haven't set any
  // services up yet.
  let pointsEarned: number;
  if (linkedAppointment && (linkedAppointment.points_awarded as number) > 0) {
    pointsEarned = 0;
  } else if (serviceId) {
    const serviceRows = await query(
      `SELECT points_value FROM salon_services WHERE id = :serviceId::uuid AND salon_id = :salonId::uuid`,
      { serviceId, salonId }
    );
    const service = serviceRows[0];
    if (!service) throw new HttpError(404, "Service not found");
    pointsEarned = Number(service.points_value);
  } else {
    // 1 point per dollar spent, scaled by the salon's own reward multiplier -
    // ties visit earning to the same reward_multiplier already shown
    // throughout the app (e.g. "2x Rewards" badges).
    pointsEarned = Math.round(amountSpent * rewardMultiplier);
  }

  const result = await runInTransaction(async (tx) => {
    // Lock any pending referral for (this client, this salon) before
    // deciding whether to complete it - same FOR UPDATE pattern as
    // redeemReward.ts, so two concurrent visit-logging calls for the same
    // referred client can't both complete (and double-pay) it. Checked
    // before inserting the visit so the visit's own `source` column can
    // reflect whether it's the one that completed a referral.
    const referralRows = await query(
      `SELECT id, referrer_id FROM referrals
       WHERE referred_id = :clientId::uuid AND salon_id = :salonId::uuid AND status = 'pending'
       FOR UPDATE`,
      { clientId, salonId },
      tx
    );
    const referral = referralRows[0];
    const referralBonus = referral ? REFERRAL_BONUS : 0;
    const source = referral ? "referral" : "direct";

    const visitRows = await query(
      `INSERT INTO visits (client_id, salon_id, logged_by, amount_spent, points_earned, source, appointment_id)
       VALUES (:clientId::uuid, :salonId::uuid, :ownerId::uuid, :amountSpent, :pointsEarned, :source::visit_source, :appointmentId::uuid)
       RETURNING id`,
      {
        clientId,
        salonId,
        ownerId,
        amountSpent,
        pointsEarned,
        source,
        appointmentId: (appointmentId as string | undefined) ?? null,
      },
      tx
    );
    const visitId = visitRows[0].id as string;

    if (referral) {
      await execute(
        `UPDATE referrals SET status = 'completed', points_awarded = :bonus, completed_at = now() WHERE id = :id::uuid`,
        { id: referral.id as string, bonus: REFERRAL_BONUS },
        tx
      );
    }

    // Visit points and the referred-client's own referral bonus both land on
    // the same (client, salon) balance row, so they're combined into one
    // upsert rather than two separate ones touching the same row.
    const clientTotalPoints = pointsEarned + referralBonus;
    const balanceRows = await query(
      `INSERT INTO salon_points_balance (client_id, salon_id, points)
       VALUES (:clientId::uuid, :salonId::uuid, :clientTotalPoints)
       ON CONFLICT (client_id, salon_id)
       DO UPDATE SET points = salon_points_balance.points + :clientTotalPoints, updated_at = now()
       RETURNING points`,
      { clientId, salonId, clientTotalPoints },
      tx
    );
    const newBalance = balanceRows[0].points as number;

    // Skip the ledger entry entirely when there's nothing to record - a
    // linked appointment that already paid out its points at booking time
    // (see the pointsEarned = 0 case above) shouldn't get a zero-value
    // "earn_visit" row cluttering the audit trail.
    if (pointsEarned > 0) {
      await execute(
        `INSERT INTO point_transactions (client_id, salon_id, type, points_delta, reference_id, note)
         VALUES (:clientId::uuid, :salonId::uuid, 'earn_visit', :pointsEarned, :visitId::uuid, :note)`,
        {
          clientId,
          salonId,
          pointsEarned,
          visitId,
          note: `Visit: $${amountSpent.toFixed(2)} spent`,
        },
        tx
      );
    }

    if (referral) {
      const referrerId = referral.referrer_id as string;

      await execute(
        `INSERT INTO point_transactions (client_id, salon_id, type, points_delta, reference_id, note)
         VALUES (:clientId::uuid, :salonId::uuid, 'earn_referral', :bonus, :referralId::uuid, 'Referral bonus - you were referred here')`,
        { clientId, salonId, bonus: REFERRAL_BONUS, referralId: referral.id as string },
        tx
      );

      await execute(
        `INSERT INTO salon_points_balance (client_id, salon_id, points)
         VALUES (:referrerId::uuid, :salonId::uuid, :bonus)
         ON CONFLICT (client_id, salon_id)
         DO UPDATE SET points = salon_points_balance.points + :bonus, updated_at = now()`,
        { referrerId, salonId, bonus: REFERRAL_BONUS },
        tx
      );

      await execute(
        `INSERT INTO point_transactions (client_id, salon_id, type, points_delta, reference_id, note)
         VALUES (:referrerId::uuid, :salonId::uuid, 'earn_referral', :bonus, :referralId::uuid, 'Referral bonus - your friend visited')`,
        { referrerId, salonId, bonus: REFERRAL_BONUS, referralId: referral.id as string },
        tx
      );

      await insertNotification(
        clientId,
        "referral",
        "Welcome bonus!",
        `You earned ${REFERRAL_BONUS} bonus points at ${salonName} from your referral.`,
        tx
      );
      await insertNotification(
        referrerId,
        "referral",
        "Your friend visited!",
        `You earned ${REFERRAL_BONUS} bonus points at ${salonName} because your referral visited.`,
        tx
      );
    }

    // Skip a "you earned 0 points" notification for a visit that just
    // confirms an appointment whose points were already awarded at payment
    // time - that would read as a bug, not as news.
    if (pointsEarned > 0) await insertNotification(
      clientId,
      "reward",
      "Points earned!",
      `You earned ${pointsEarned} points at ${salonName}.`,
      tx
    );

    return { visitId, pointsEarned, newBalance, referralCompleted: !!referral, referralBonus };
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitId: result.visitId,
      clientId,
      salonId,
      amountSpent,
      pointsEarned: result.pointsEarned,
      newBalance: result.newBalance,
      referralCompleted: result.referralCompleted,
      referralBonus: result.referralBonus,
    }),
  };
}
