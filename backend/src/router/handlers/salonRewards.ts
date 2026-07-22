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
    `SELECT r.id, r.salon_id, r.title, r.description, r.points_cost, r.category, r.discount_percent,
            p.name AS free_product_name, r.expires_at
     FROM rewards r
     LEFT JOIN salon_products p ON p.id = r.free_product_id
     WHERE r.salon_id = :salonId::uuid
       AND r.is_active = true
       AND (r.expires_at IS NULL OR r.expires_at > now())
     ORDER BY r.points_cost`,
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
        discountPercent: r.discount_percent,
        freeProductName: r.free_product_name,
        expiresAt: r.expires_at,
      }))
    ),
  };
}
