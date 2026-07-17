import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query, execute } from "../../shared/db";
import { HttpError } from "../../shared/httpError";
import { isUuid } from "../../shared/validation";

// Applying a referral is a normal authenticated action taken right after
// signup completes (see SignupScreen), not something threaded through
// Cognito signup attributes - that would mean changing the User Pool's
// schema after creation, which risks requiring the pool to be recreated
// (and every account with it). A follow-up API call avoids that entirely.
export async function applyReferral(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const referredId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!referredId) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let referralCode: unknown;
  let salonId: unknown;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    referralCode = body.referralCode;
    salonId = body.salonId;
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  if (typeof referralCode !== "string" || referralCode.trim().length === 0) {
    throw new HttpError(400, "Missing referralCode");
  }
  if (!isUuid(salonId)) {
    throw new HttpError(400, "Invalid salonId");
  }

  const existingRows = await query(
    `SELECT id FROM referrals WHERE referred_id = :referredId::uuid`,
    { referredId }
  );
  if (existingRows[0]) {
    throw new HttpError(400, "You've already been referred");
  }

  const referrerRows = await query(
    `SELECT id FROM users WHERE referral_code = :referralCode AND role = 'client'`,
    { referralCode: referralCode.trim() }
  );
  const referrer = referrerRows[0];
  if (!referrer) {
    throw new HttpError(404, "Invalid referral code");
  }
  const referrerId = referrer.id as string;
  if (referrerId === referredId) {
    throw new HttpError(400, "You can't refer yourself");
  }

  const salonRows = await query(`SELECT id FROM salons WHERE id = :salonId::uuid`, { salonId });
  if (!salonRows[0]) {
    throw new HttpError(404, "Salon not found");
  }

  const inserted = await query(
    `INSERT INTO referrals (referrer_id, referred_id, salon_id, status)
     VALUES (:referrerId::uuid, :referredId::uuid, :salonId::uuid, 'pending')
     RETURNING id, status, created_at`,
    { referrerId, referredId, salonId }
  );
  const referral = inserted[0];

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: referral.id,
      status: referral.status,
      createdAt: referral.created_at,
    }),
  };
}

export async function getMyReferrals(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const referrerId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!referrerId) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const rows = await query(
    `SELECT r.id, r.salon_id, s.name AS salon_name, r.status, r.points_awarded,
            r.created_at, r.completed_at, u.name AS referred_name
     FROM referrals r
     JOIN salons s ON s.id = r.salon_id
     JOIN users u ON u.id = r.referred_id
     WHERE r.referrer_id = :referrerId::uuid
     ORDER BY r.created_at DESC`,
    { referrerId }
  );

  const totalCompleted = rows.filter((r) => r.status === "completed").length;
  const totalPointsEarned = rows.reduce((sum, r) => sum + ((r.points_awarded as number) ?? 0), 0);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      referrals: rows.map((r) => ({
        id: r.id,
        referredName: r.referred_name,
        salonId: r.salon_id,
        salonName: r.salon_name,
        status: r.status,
        pointsAwarded: r.points_awarded,
        createdAt: r.created_at,
        completedAt: r.completed_at,
      })),
      totalCompleted,
      totalPointsEarned,
    }),
  };
}
