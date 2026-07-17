import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query, execute } from "../../shared/db";
import { HttpError } from "../../shared/httpError";

async function fetchSalonMeResponse(ownerId: string) {
  const rows = await query(
    `SELECT id, name, address, phone, email, description, image_url, reward_multiplier, rating, review_count
     FROM salons
     WHERE owner_user_id = :ownerId::uuid`,
    { ownerId }
  );
  const salon = rows[0];
  if (!salon) return null;

  return {
    id: salon.id,
    name: salon.name,
    address: salon.address,
    phone: salon.phone,
    email: salon.email,
    description: salon.description,
    image: salon.image_url,
    rewardMultiplier: salon.reward_multiplier,
    rating: salon.rating,
    reviewCount: salon.review_count,
  };
}

export async function getSalonMe(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!ownerId) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const salon = await fetchSalonMeResponse(ownerId);
  if (!salon) {
    throw new HttpError(404, "No salon found for this account");
  }

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(salon) };
}

export async function updateSalonMe(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!ownerId) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let name: unknown, address: unknown, phone: unknown, email: unknown, description: unknown;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    ({ name, address, phone, email, description } = body);
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new HttpError(400, "name is required");
  }
  for (const [field, value] of [
    ["address", address],
    ["phone", phone],
    ["email", email],
    ["description", description],
  ] as const) {
    if (value !== null && value !== undefined && typeof value !== "string") {
      throw new HttpError(400, `${field} must be a string or null`);
    }
  }

  const updated = await execute(
    `UPDATE salons
     SET name = :name, address = :address, phone = :phone, email = :email, description = :description
     WHERE owner_user_id = :ownerId::uuid`,
    {
      ownerId,
      name: (name as string).trim(),
      address: (address as string | null) ?? null,
      phone: (phone as string | null) ?? null,
      email: (email as string | null) ?? null,
      description: (description as string | null) ?? null,
    }
  );
  if (updated === 0) {
    throw new HttpError(404, "No salon found for this account");
  }

  const salon = await fetchSalonMeResponse(ownerId);
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(salon) };
}

export async function updateSalonLogo(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!ownerId) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let imageUrl: unknown;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    imageUrl = body.imageUrl;
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  if (typeof imageUrl !== "string" || imageUrl.trim().length === 0) {
    throw new HttpError(400, "imageUrl is required");
  }

  const updated = await execute(
    `UPDATE salons SET image_url = :imageUrl WHERE owner_user_id = :ownerId::uuid`,
    { ownerId, imageUrl }
  );
  if (updated === 0) {
    throw new HttpError(404, "No salon found for this account");
  }

  const salon = await fetchSalonMeResponse(ownerId);
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(salon) };
}
