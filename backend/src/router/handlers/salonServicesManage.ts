import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query, execute } from "../../shared/db";
import { HttpError } from "../../shared/httpError";
import { requireOwnedSalonId } from "../../shared/salonAuth";
import { isUuid } from "../../shared/validation";

function getOwnerId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string | undefined {
  return event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
}

interface ServiceInput {
  name: string;
  price: number;
}

function parseServiceInput(body: unknown): ServiceInput {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    throw new HttpError(400, "name is required");
  }
  if (typeof b.price !== "number" || !Number.isFinite(b.price) || b.price < 0) {
    throw new HttpError(400, "price must be a non-negative number");
  }
  return { name: b.name.trim(), price: b.price };
}

export async function getSalonServicesManage(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const salonId = await requireOwnedSalonId(ownerId);

  const services = await query(
    `SELECT id, name, price FROM salon_services WHERE salon_id = :salonId::uuid ORDER BY created_at`,
    { salonId }
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      services.map((s) => ({ id: s.id, name: s.name, price: s.price }))
    ),
  };
}

export async function createSalonService(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  let input: ServiceInput;
  try {
    input = parseServiceInput(event.body ? JSON.parse(event.body) : {});
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "Invalid request body");
  }

  const salonId = await requireOwnedSalonId(ownerId);

  const rows = await query(
    `INSERT INTO salon_services (salon_id, name, price)
     VALUES (:salonId::uuid, :name, :price)
     RETURNING id, name, price`,
    { salonId, ...input }
  );
  const s = rows[0];

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: s.id, name: s.name, price: s.price }),
  };
}

export async function updateSalonService(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const serviceId = event.pathParameters?.serviceId;
  if (!isUuid(serviceId)) throw new HttpError(400, "Invalid serviceId");

  let input: ServiceInput;
  try {
    input = parseServiceInput(event.body ? JSON.parse(event.body) : {});
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "Invalid request body");
  }

  const salonId = await requireOwnedSalonId(ownerId);

  // Scoping the UPDATE to salon_id (not just the serviceId) stops a salon
  // owner from editing a service that belongs to a different salon - same
  // data-scoping pattern used for rewards/campaigns.
  const updated = await execute(
    `UPDATE salon_services SET name = :name, price = :price
     WHERE id = :serviceId::uuid AND salon_id = :salonId::uuid`,
    { serviceId, salonId, ...input }
  );
  if (updated === 0) {
    throw new HttpError(404, "Service not found");
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: serviceId, ...input }),
  };
}

export async function deleteSalonService(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const serviceId = event.pathParameters?.serviceId;
  if (!isUuid(serviceId)) throw new HttpError(400, "Invalid serviceId");

  const salonId = await requireOwnedSalonId(ownerId);

  const deleted = await execute(
    `DELETE FROM salon_services WHERE id = :serviceId::uuid AND salon_id = :salonId::uuid`,
    { serviceId, salonId }
  );
  if (deleted === 0) {
    throw new HttpError(404, "Service not found");
  }

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: true }) };
}
