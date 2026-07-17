import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query } from "../../shared/db";
import { HttpError } from "../../shared/httpError";
import { isUuid } from "../../shared/validation";

export async function getSalonRewards(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const salonId = event.pathParameters?.salonId;
  if (!salonId || !isUuid(salonId)) {
    throw new HttpError(400, "Invalid salonId");
  }

  const rows = await query(
    `SELECT id, salon_id, title, description, points_cost, category, expires_at
     FROM rewards
     WHERE salon_id = :salonId::uuid
       AND is_active = true
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY points_cost`,
    { salonId }
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        salonId: r.salon_id,
        title: r.title,
        description: r.description,
        pointsCost: r.points_cost,
        category: r.category,
        expiresAt: r.expires_at,
      }))
    ),
  };
}
