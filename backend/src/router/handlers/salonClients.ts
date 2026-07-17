import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query } from "../../shared/db";
import { requireOwnedSalonId } from "../../shared/salonAuth";

export async function getSalonClients(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!ownerId) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const salonId = await requireOwnedSalonId(ownerId);

  // Inner join on salon_points_balance is what scopes this to "clients with
  // any relationship to this salon" - that row only exists once a visit has
  // been logged here (see visits.ts), so a client who's never visited this
  // salon simply won't appear.
  const rows = await query(
    `SELECT
       u.id, u.name, u.email, u.phone, u.avatar_url,
       spb.points,
       COUNT(v.id) AS visit_count,
       COALESCE(SUM(v.amount_spent), 0) AS total_spent,
       MAX(v.visited_at) AS last_visit
     FROM salon_points_balance spb
     JOIN users u ON u.id = spb.client_id
     LEFT JOIN visits v ON v.client_id = u.id AND v.salon_id = spb.salon_id
     WHERE spb.salon_id = :salonId::uuid
     GROUP BY u.id, u.name, u.email, u.phone, u.avatar_url, spb.points
     ORDER BY u.name`,
    { salonId }
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        avatar: r.avatar_url,
        loyaltyPoints: r.points,
        visits: r.visit_count,
        totalSpent: r.total_spent,
        lastVisit: r.last_visit,
      }))
    ),
  };
}
