import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query } from "../../shared/db";
import { requireOwnedSalonId } from "../../shared/salonAuth";

export async function getSalonDashboardStats(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const salonId = await requireOwnedSalonId(ownerId);

  const [clientRows, referralRows, redemptionRows, revenueRows, pendingAppointmentRows] = await Promise.all([
    query(`SELECT count(*) AS c FROM salon_points_balance WHERE salon_id = :salonId::uuid`, { salonId }),
    query(
      `SELECT count(*) FILTER (WHERE status = 'pending') AS active FROM referrals WHERE salon_id = :salonId::uuid`,
      { salonId }
    ),
    query(`SELECT count(*) AS c FROM redemptions WHERE salon_id = :salonId::uuid`, { salonId }),
    // This month's revenue vs last month's, for a real growth percentage -
    // no fabricated arrow/badge, just an actual month-over-month comparison.
    query(
      `SELECT
         COALESCE(SUM(amount_spent) FILTER (WHERE visited_at >= date_trunc('month', now())), 0) AS this_month,
         COALESCE(SUM(amount_spent) FILTER (
           WHERE visited_at >= date_trunc('month', now()) - interval '1 month'
             AND visited_at < date_trunc('month', now())
         ), 0) AS last_month
       FROM visits WHERE salon_id = :salonId::uuid`,
      { salonId }
    ),
    query(
      `SELECT count(*) AS c FROM appointments WHERE salon_id = :salonId::uuid AND status = 'pending'`,
      { salonId }
    ),
  ]);

  const thisMonthRevenue = Number(revenueRows[0]?.this_month ?? 0);
  const lastMonthRevenue = Number(revenueRows[0]?.last_month ?? 0);
  const revenueGrowth =
    lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10
      : null; // no meaningful % change to show when last month was $0

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      totalClients: clientRows[0]?.c ?? 0,
      activeReferrals: referralRows[0]?.active ?? 0,
      rewardsIssued: redemptionRows[0]?.c ?? 0,
      monthlyRevenue: thisMonthRevenue,
      revenueGrowth,
      pendingAppointments: pendingAppointmentRows[0]?.c ?? 0,
    }),
  };
}
