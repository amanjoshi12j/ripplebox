import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query, execute } from "../../shared/db";
import { requireAdmin } from "../../shared/adminAuth";
import { HttpError } from "../../shared/httpError";

// Shared by both getAdminStats (platform-wide) and getAdminSalons (per-salon)
// below. A pay_now appointment that's later logged as an in-person visit
// (see visits.appointment_id, wired up in visits.ts) gets an amount_spent
// row on the visit AND a paid appointments row for the same real-world
// transaction - counting both would double the revenue. This counts a
// visit's amount only when it isn't already covered by a Stripe-paid
// appointment, and counts every Stripe-paid appointment directly.
const REVENUE_EXPR = (salonFilter: string) => `
  COALESCE((
    SELECT SUM(v.amount_spent) FROM visits v
    LEFT JOIN appointments ap ON ap.id = v.appointment_id
    WHERE (ap.payment_status IS DISTINCT FROM 'paid' OR ap.id IS NULL) ${salonFilter ? `AND v.salon_id = ${salonFilter}` : ""}
  ), 0)
  + COALESCE((
    SELECT SUM(price) FROM appointments
    WHERE payment_status = 'paid' ${salonFilter ? `AND salon_id = ${salonFilter}` : ""}
  ), 0)
`;

export async function getAdminStats(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  requireAdmin(event);

  const [salonRows, clientRows, ownerRows, apptRows, revenueRows, pointsRows, redemptionRows, campaignRows] =
    await Promise.all([
      query(`SELECT count(*) AS c FROM salons`),
      query(`SELECT count(*) AS c FROM users WHERE role = 'client'`),
      query(`SELECT count(*) AS c FROM users WHERE role = 'salon_owner'`),
      query(`SELECT count(*) AS c FROM appointments`),
      query(`SELECT ${REVENUE_EXPR("")} AS total`),
      query(`SELECT COALESCE(SUM(points_delta), 0) AS total FROM point_transactions WHERE points_delta > 0`),
      query(`SELECT count(*) AS c FROM redemptions`),
      query(`SELECT count(*) FILTER (WHERE status = 'active') AS active FROM campaigns`),
    ]);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      totalSalons: salonRows[0]?.c ?? 0,
      totalClients: clientRows[0]?.c ?? 0,
      totalSalonOwners: ownerRows[0]?.c ?? 0,
      totalAppointments: apptRows[0]?.c ?? 0,
      totalRevenue: revenueRows[0]?.total ?? 0,
      totalPointsIssued: pointsRows[0]?.total ?? 0,
      totalRedemptions: redemptionRows[0]?.c ?? 0,
      activeCampaigns: campaignRows[0]?.active ?? 0,
    }),
  };
}

export async function getAdminSalons(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  requireAdmin(event);

  const q = event.queryStringParameters?.q?.trim() ?? "";

  const rows = await query(
    `SELECT
       s.id, s.name, s.email AS salon_email, s.created_at, s.is_suspended,
       u.id AS owner_id, u.name AS owner_name, u.email AS owner_email,
       (SELECT count(*) FROM salon_points_balance spb WHERE spb.salon_id = s.id) AS client_count,
       (SELECT count(*) FROM redemptions r WHERE r.salon_id = s.id) AS rewards_issued,
       (SELECT count(*) FROM appointments a WHERE a.salon_id = s.id) AS appointment_count,
       ${REVENUE_EXPR("s.id")} AS total_revenue
     FROM salons s
     JOIN users u ON u.id = s.owner_user_id
     WHERE :q = '' OR s.name ILIKE '%' || :q || '%' OR u.email ILIKE '%' || :q || '%'
     ORDER BY s.created_at DESC
     LIMIT 200`,
    { q }
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.salon_email,
        createdAt: r.created_at,
        isSuspended: r.is_suspended,
        ownerId: r.owner_id,
        ownerName: r.owner_name,
        ownerEmail: r.owner_email,
        clientCount: r.client_count,
        rewardsIssued: r.rewards_issued,
        appointmentCount: r.appointment_count,
        totalRevenue: r.total_revenue,
      }))
    ),
  };
}

export async function updateAdminSalon(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  requireAdmin(event);

  const salonId = event.pathParameters?.salonId;
  if (!salonId) throw new HttpError(400, "Missing salon id");

  let isSuspended: unknown;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    isSuspended = body.isSuspended;
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  if (typeof isSuspended !== "boolean") {
    throw new HttpError(400, "isSuspended must be true or false");
  }

  const updated = await execute(`UPDATE salons SET is_suspended = :isSuspended WHERE id = :salonId::uuid`, {
    salonId,
    isSuspended,
  });
  if (updated === 0) throw new HttpError(404, "Salon not found");

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: salonId, isSuspended }),
  };
}

export async function getAdminUsers(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  requireAdmin(event);

  const q = event.queryStringParameters?.q?.trim() ?? "";

  const rows = await query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at, s.id AS salon_id, s.name AS salon_name
     FROM users u
     LEFT JOIN salons s ON s.owner_user_id = u.id
     WHERE :q = '' OR u.name ILIKE '%' || :q || '%' OR u.email ILIKE '%' || :q || '%'
     ORDER BY u.created_at DESC
     LIMIT 200`,
    { q }
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        createdAt: r.created_at,
        salonId: r.salon_id,
        salonName: r.salon_name,
      }))
    ),
  };
}
