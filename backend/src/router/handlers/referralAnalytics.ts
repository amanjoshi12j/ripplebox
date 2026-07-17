import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query } from "../../shared/db";
import { requireOwnedSalonId } from "../../shared/salonAuth";

export async function getSalonReferralAnalytics(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const salonId = await requireOwnedSalonId(ownerId);

  const [countRows, trendRows, topReferrerRows, sourceRows] = await Promise.all([
    query(
      `SELECT
         count(*) FILTER (WHERE status = 'pending') AS active,
         count(*) FILTER (WHERE status = 'completed') AS conversions
       FROM referrals WHERE salon_id = :salonId::uuid`,
      { salonId }
    ),
    // Real last-7-months trend, not a fabricated curve - will look sparse
    // until the salon has actual referral history, which is the honest
    // reflection of a fresh app rather than a compelling-looking mock.
    query(
      `SELECT
         to_char(month_series, 'Mon') AS month,
         COALESCE(r.referral_count, 0) AS referrals,
         COALESCE(c.conversion_count, 0) AS conversions
       FROM generate_series(
         date_trunc('month', now()) - interval '6 months',
         date_trunc('month', now()),
         interval '1 month'
       ) AS month_series
       LEFT JOIN (
         SELECT date_trunc('month', created_at) AS month, count(*) AS referral_count
         FROM referrals WHERE salon_id = :salonId::uuid GROUP BY 1
       ) r ON r.month = month_series
       LEFT JOIN (
         SELECT date_trunc('month', completed_at) AS month, count(*) AS conversion_count
         FROM referrals WHERE salon_id = :salonId::uuid AND status = 'completed' GROUP BY 1
       ) c ON c.month = month_series
       ORDER BY month_series`,
      { salonId }
    ),
    // Revenue here attributes the referred client's full visit spend at this
    // salon to whoever referred them - a simple approximation, not
    // per-visit-sourced revenue (which the schema doesn't track).
    // COUNT(DISTINCT r.id), not COUNT(*): the join to visits fans out one
    // row per visit, so a referred client with multiple visits would
    // otherwise inflate their referrer's referral count.
    query(
      `SELECT u.name, count(DISTINCT r.id) AS referral_count, COALESCE(SUM(v.amount_spent), 0) AS revenue
       FROM referrals r
       JOIN users u ON u.id = r.referrer_id
       LEFT JOIN visits v ON v.client_id = r.referred_id AND v.salon_id = r.salon_id
       WHERE r.salon_id = :salonId::uuid AND r.status = 'completed'
       GROUP BY u.id, u.name
       ORDER BY referral_count DESC, revenue DESC
       LIMIT 5`,
      { salonId }
    ),
    // Real 2-way split (referral vs direct) - the only channel the app can
    // actually attribute a visit to (see visit_source in schema.sql). No
    // "marketing" bucket: campaigns have no linkage back to a specific visit.
    query(
      `SELECT source, COALESCE(SUM(amount_spent), 0) AS revenue
       FROM visits WHERE salon_id = :salonId::uuid GROUP BY source`,
      { salonId }
    ),
  ]);

  const revenueBySource = { referral: 0, direct: 0 } as Record<string, number>;
  for (const row of sourceRows) {
    revenueBySource[row.source as string] = Number(row.revenue);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activeReferrals: countRows[0]?.active ?? 0,
      conversions: countRows[0]?.conversions ?? 0,
      trend: trendRows.map((r) => ({
        month: r.month,
        referrals: r.referrals,
        conversions: r.conversions,
      })),
      topReferrers: topReferrerRows.map((r) => ({
        name: r.name,
        referrals: r.referral_count,
        revenue: r.revenue,
      })),
      revenueBySource: [
        { name: "Referral", value: revenueBySource.referral },
        { name: "Direct", value: revenueBySource.direct },
      ],
    }),
  };
}
