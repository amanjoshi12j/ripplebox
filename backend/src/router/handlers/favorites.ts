import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query, execute } from "../../shared/db";
import { HttpError } from "../../shared/httpError";
import { isUuid } from "../../shared/validation";

function getClientId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string | undefined {
  return event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
}

export async function getMyFavorites(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const clientId = getClientId(event);
  if (!clientId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const rows = await query(`SELECT salon_id FROM favorite_salons WHERE client_id = :clientId::uuid`, {
    clientId,
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows.map((r) => r.salon_id)),
  };
}

export async function addFavorite(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const clientId = getClientId(event);
  if (!clientId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const salonId = event.pathParameters?.salonId;
  if (!isUuid(salonId)) throw new HttpError(400, "Invalid salonId");

  const salonRows = await query(`SELECT id FROM salons WHERE id = :salonId::uuid`, { salonId });
  if (!salonRows[0]) throw new HttpError(404, "Salon not found");

  await execute(
    `INSERT INTO favorite_salons (client_id, salon_id) VALUES (:clientId::uuid, :salonId::uuid)
     ON CONFLICT (client_id, salon_id) DO NOTHING`,
    { clientId, salonId }
  );

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
}

export async function removeFavorite(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const clientId = getClientId(event);
  if (!clientId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const salonId = event.pathParameters?.salonId;
  if (!isUuid(salonId)) throw new HttpError(400, "Invalid salonId");

  await execute(`DELETE FROM favorite_salons WHERE client_id = :clientId::uuid AND salon_id = :salonId::uuid`, {
    clientId,
    salonId,
  });

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
}
