import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query, execute, runInTransaction } from "../../shared/db";
import { HttpError } from "../../shared/httpError";
import { requireOwnedSalonId } from "../../shared/salonAuth";
import { getStripeClient } from "../../shared/stripe";
import { isUuid } from "../../shared/validation";
import { insertNotification } from "../../shared/notifications";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const PAYMENT_METHODS = new Set(["pay_now", "pay_later"]);

function getCallerId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string | undefined {
  return event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function createAppointment(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const clientId = getCallerId(event);
  if (!clientId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  let salonId: unknown, serviceId: unknown, date: unknown, time: unknown, paymentMethod: unknown, paymentIntentId: unknown;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    ({ salonId, serviceId, date, time, paymentMethod, paymentIntentId } = body);
  } catch {
    throw new HttpError(400, "Invalid request body");
  }

  if (!isUuid(salonId) || !isUuid(serviceId)) {
    throw new HttpError(400, "salonId and serviceId must be valid ids");
  }
  if (typeof date !== "string" || !DATE_RE.test(date) || date < todayUtc()) {
    throw new HttpError(400, "date must be a valid YYYY-MM-DD date not in the past");
  }
  if (typeof time !== "string" || !TIME_RE.test(time)) {
    throw new HttpError(400, "time must be in HH:MM (24-hour) format");
  }
  if (typeof paymentMethod !== "string" || !PAYMENT_METHODS.has(paymentMethod)) {
    throw new HttpError(400, "paymentMethod must be 'pay_now' or 'pay_later'");
  }

  const serviceRows = await query(
    `SELECT id, name, price, points_value FROM salon_services WHERE id = :serviceId::uuid AND salon_id = :salonId::uuid`,
    { serviceId, salonId }
  );
  const service = serviceRows[0];
  if (!service) throw new HttpError(404, "Service not found");
  const price = Number(service.price);
  const servicePointsValue = Number(service.points_value);

  let paymentStatus = "unpaid";
  if (paymentMethod === "pay_now") {
    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      throw new HttpError(400, "paymentIntentId is required for pay_now");
    }
    const alreadyUsed = await query(
      `SELECT id FROM appointments WHERE stripe_payment_intent_id = :paymentIntentId`,
      { paymentIntentId }
    );
    if (alreadyUsed[0]) {
      throw new HttpError(400, "This payment has already been used for a booking");
    }

    // Stripe is the source of truth for whether the card charge actually
    // succeeded - never trust the frontend's word for it.
    const stripe = getStripeClient();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      throw new HttpError(400, "Payment has not completed successfully");
    }
    if (
      intent.metadata.salonId !== salonId ||
      intent.metadata.serviceId !== serviceId ||
      intent.metadata.clientId !== clientId
    ) {
      throw new HttpError(400, "Payment does not match this booking");
    }
    if (intent.amount !== Math.round(price * 100)) {
      throw new HttpError(400, "Payment amount does not match the service price");
    }
    paymentStatus = "paid";
  }

  // Paying up front earns points immediately (the client has already paid,
  // unlike pay_later where points only come once the salon logs the actual
  // visit - see logVisit). Awarding and the appointment insert happen in one
  // transaction so a points bug can never create an appointment without its
  // matching ledger entry, or vice versa - same discipline as visits.ts.
  const pointsAwarded = paymentMethod === "pay_now" ? servicePointsValue : 0;

  const appt = await runInTransaction(async (tx) => {
    const rows = await query(
      `INSERT INTO appointments
         (salon_id, client_id, service_id, price, appointment_date, appointment_time,
          payment_method, payment_status, stripe_payment_intent_id, points_awarded)
       VALUES
         (:salonId::uuid, :clientId::uuid, :serviceId::uuid, :price, :date::date, :time,
          :paymentMethod::appointment_payment_method, :paymentStatus::appointment_payment_status,
          :paymentIntentId, :pointsAwarded)
       RETURNING id, status, payment_status, appointment_date, appointment_time`,
      {
        salonId,
        clientId,
        serviceId,
        price,
        date,
        time,
        paymentMethod,
        paymentStatus,
        paymentIntentId: (paymentIntentId as string | undefined) ?? null,
        pointsAwarded,
      },
      tx
    );
    const inserted = rows[0];

    if (pointsAwarded > 0) {
      await execute(
        `INSERT INTO salon_points_balance (client_id, salon_id, points)
         VALUES (:clientId::uuid, :salonId::uuid, :pointsAwarded)
         ON CONFLICT (client_id, salon_id)
         DO UPDATE SET points = salon_points_balance.points + :pointsAwarded, updated_at = now()`,
        { clientId, salonId, pointsAwarded },
        tx
      );
      await execute(
        `INSERT INTO point_transactions (client_id, salon_id, type, points_delta, reference_id, note)
         VALUES (:clientId::uuid, :salonId::uuid, 'earn_appointment', :pointsAwarded, :appointmentId::uuid, :note)`,
        {
          clientId,
          salonId,
          pointsAwarded,
          appointmentId: inserted.id as string,
          note: `Paid booking: ${service.name}`,
        },
        tx
      );
    }

    return inserted;
  });

  const salonRows = await query(`SELECT owner_user_id, name FROM salons WHERE id = :salonId::uuid`, { salonId });
  const salon = salonRows[0];
  if (salon) {
    await insertNotification(
      salon.owner_user_id as string,
      "appointment",
      "New booking request",
      `A client requested ${service.name} on ${date} at ${time}.`
    );
  }
  if (pointsAwarded > 0) {
    await insertNotification(
      clientId,
      "reward",
      "Points earned!",
      `You earned ${pointsAwarded} points for booking ${service.name}${salon ? ` at ${salon.name}` : ""}.`
    );
  }

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: appt.id,
      status: appt.status,
      paymentStatus: appt.payment_status,
      date: appt.appointment_date,
      time: appt.appointment_time,
      pointsAwarded,
    }),
  };
}

export async function getMyAppointments(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const clientId = getCallerId(event);
  if (!clientId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const rows = await query(
    `SELECT a.id, a.salon_id, s.name AS salon_name, a.service_id, sv.name AS service_name,
            a.price, a.appointment_date, a.appointment_time, a.status,
            a.payment_method, a.payment_status, a.points_awarded
     FROM appointments a
     JOIN salons s ON s.id = a.salon_id
     JOIN salon_services sv ON sv.id = a.service_id
     WHERE a.client_id = :clientId::uuid
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
    { clientId }
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        salonId: r.salon_id,
        salonName: r.salon_name,
        serviceId: r.service_id,
        serviceName: r.service_name,
        price: r.price,
        date: r.appointment_date,
        time: r.appointment_time,
        status: r.status,
        paymentMethod: r.payment_method,
        paymentStatus: r.payment_status,
        pointsAwarded: r.points_awarded,
      }))
    ),
  };
}

export async function getSalonAppointments(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getCallerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const salonId = await requireOwnedSalonId(ownerId);

  const rows = await query(
    `SELECT a.id, u.name AS client_name, u.email AS client_email, a.service_id, sv.name AS service_name,
            a.price, a.appointment_date, a.appointment_time, a.status,
            a.payment_method, a.payment_status, a.points_awarded
     FROM appointments a
     JOIN users u ON u.id = a.client_id
     JOIN salon_services sv ON sv.id = a.service_id
     WHERE a.salon_id = :salonId::uuid
     ORDER BY a.appointment_date, a.appointment_time`,
    { salonId }
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        clientName: r.client_name,
        clientEmail: r.client_email,
        serviceId: r.service_id,
        serviceName: r.service_name,
        price: r.price,
        date: r.appointment_date,
        time: r.appointment_time,
        status: r.status,
        paymentMethod: r.payment_method,
        paymentStatus: r.payment_status,
        pointsAwarded: r.points_awarded,
      }))
    ),
  };
}

const OWNER_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "declined"],
  confirmed: ["cancelled"],
};

// Reverses whatever points a pay_now appointment awarded at booking time,
// when that appointment ends up declined/cancelled instead of fulfilled.
// Clamps to the client's current balance rather than assuming the full
// amount is still there (they may have already spent some of it on a
// redemption) - the ledger entry records what was actually taken back, not
// what was originally awarded, so the audit trail stays honest.
async function reverseAppointmentPoints(
  tx: string,
  clientId: string,
  salonId: string,
  appointmentId: string,
  pointsAwarded: number,
  serviceName: string,
  reasonLabel: string
): Promise<void> {
  const balanceRows = await query(
    `SELECT points FROM salon_points_balance WHERE client_id = :clientId::uuid AND salon_id = :salonId::uuid FOR UPDATE`,
    { clientId, salonId },
    tx
  );
  const currentPoints = (balanceRows[0]?.points as number) ?? 0;
  const actualDeduction = Math.min(pointsAwarded, currentPoints);
  if (actualDeduction <= 0) return;

  await execute(
    `UPDATE salon_points_balance SET points = points - :actualDeduction, updated_at = now()
     WHERE client_id = :clientId::uuid AND salon_id = :salonId::uuid`,
    { clientId, salonId, actualDeduction },
    tx
  );
  await execute(
    `INSERT INTO point_transactions (client_id, salon_id, type, points_delta, reference_id, note)
     VALUES (:clientId::uuid, :salonId::uuid, 'adjustment', :delta, :appointmentId::uuid, :note)`,
    {
      clientId,
      salonId,
      delta: -actualDeduction,
      appointmentId,
      note: `Booking ${reasonLabel}: ${serviceName}`,
    },
    tx
  );
  await insertNotification(
    clientId,
    "alert",
    "Points removed",
    `${actualDeduction} points from your ${serviceName} booking were removed because it was ${reasonLabel}.`,
    tx
  );
}

export async function updateSalonAppointmentStatus(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getCallerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const appointmentId = event.pathParameters?.appointmentId;
  if (!isUuid(appointmentId)) throw new HttpError(400, "Invalid appointmentId");

  let status: unknown;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    ({ status } = body);
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  if (typeof status !== "string") throw new HttpError(400, "status is required");

  const salonId = await requireOwnedSalonId(ownerId);

  const rows = await query(
    `SELECT a.status, a.client_id, a.appointment_date, a.appointment_time, a.points_awarded, sv.name AS service_name
     FROM appointments a JOIN salon_services sv ON sv.id = a.service_id
     WHERE a.id = :appointmentId::uuid AND a.salon_id = :salonId::uuid`,
    { appointmentId, salonId }
  );
  const appt = rows[0];
  if (!appt) throw new HttpError(404, "Appointment not found");

  const allowed = OWNER_TRANSITIONS[appt.status as string] ?? [];
  if (!allowed.includes(status)) {
    throw new HttpError(400, `Can't move an appointment from ${appt.status} to ${status}`);
  }

  const pointsAwarded = (appt.points_awarded as number) ?? 0;
  const isEndingUnfulfilled = status === "declined" || status === "cancelled";

  await runInTransaction(async (tx) => {
    await execute(
      `UPDATE appointments SET status = :status::appointment_status
       WHERE id = :appointmentId::uuid AND salon_id = :salonId::uuid`,
      { appointmentId, salonId, status },
      tx
    );

    if (isEndingUnfulfilled && pointsAwarded > 0) {
      await reverseAppointmentPoints(
        tx,
        appt.client_id as string,
        salonId,
        appointmentId as string,
        pointsAwarded,
        appt.service_name as string,
        status as string
      );
    }
  });

  const statusLabel = status === "confirmed" ? "confirmed" : status === "declined" ? "declined" : "cancelled";
  await insertNotification(
    appt.client_id as string,
    "appointment",
    `Booking ${statusLabel}`,
    `Your ${appt.service_name} booking on ${appt.appointment_date} at ${appt.appointment_time} was ${statusLabel} by the salon.`
  );

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: appointmentId, status }) };
}

export async function cancelMyAppointment(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const clientId = getCallerId(event);
  if (!clientId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const appointmentId = event.pathParameters?.appointmentId;
  if (!isUuid(appointmentId)) throw new HttpError(400, "Invalid appointmentId");

  const rows = await query(
    `SELECT status, salon_id, appointment_date, appointment_time, points_awarded,
            (SELECT name FROM salon_services WHERE id = appointments.service_id) AS service_name,
            (SELECT owner_user_id FROM salons WHERE id = appointments.salon_id) AS owner_id
     FROM appointments WHERE id = :appointmentId::uuid AND client_id = :clientId::uuid`,
    { appointmentId, clientId }
  );
  const appt = rows[0];
  if (!appt) throw new HttpError(404, "Appointment not found");

  // Cancelling only while still pending keeps this v1 - a paid+confirmed
  // cancellation would need a real refund flow (Stripe refund API), which
  // doesn't exist yet (see the schema comment on appointment_payment_status).
  if (appt.status !== "pending") {
    throw new HttpError(400, "Only a pending appointment can be cancelled this way");
  }

  const salonId = appt.salon_id as string;
  const pointsAwarded = (appt.points_awarded as number) ?? 0;

  await runInTransaction(async (tx) => {
    await execute(
      `UPDATE appointments SET status = 'cancelled' WHERE id = :appointmentId::uuid AND client_id = :clientId::uuid`,
      { appointmentId, clientId },
      tx
    );

    if (pointsAwarded > 0) {
      await reverseAppointmentPoints(
        tx,
        clientId,
        salonId,
        appointmentId as string,
        pointsAwarded,
        appt.service_name as string,
        "cancelled"
      );
    }
  });

  if (appt.owner_id) {
    await insertNotification(
      appt.owner_id as string,
      "appointment",
      "Booking cancelled",
      `A client cancelled their ${appt.service_name} booking on ${appt.appointment_date} at ${appt.appointment_time}.`
    );
  }

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: appointmentId, status: "cancelled" }) };
}
