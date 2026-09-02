import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query, execute } from "../../shared/db";
import { HttpError } from "../../shared/httpError";

async function fetchSalonMeResponse(ownerId: string) {
  const rows = await query(
    `SELECT id, name, address, latitude, longitude, phone, email, description, image_url, reward_multiplier, rating, review_count, is_suspended
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
    latitude: salon.latitude,
    longitude: salon.longitude,
    phone: salon.phone,
    email: salon.email,
    description: salon.description,
    image: salon.image_url,
    rewardMultiplier: salon.reward_multiplier,
    rating: salon.rating,
    reviewCount: salon.review_count,
    // Set only by the admin panel - see backend/src/shared/adminAuth.ts. The
    // owner can still sign in and use everything else; this just tells them
    // (and the dashboard banner) that their salon is currently hidden from
    // clients.
    isSuspended: salon.is_suspended,
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

export async function updateSalonLocation(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!ownerId) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let latitude: unknown, longitude: unknown;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    ({ latitude, longitude } = body);
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new HttpError(400, "latitude/longitude must be valid coordinates");
  }

  const updated = await execute(
    `UPDATE salons SET latitude = :latitude, longitude = :longitude WHERE owner_user_id = :ownerId::uuid`,
    { ownerId, latitude, longitude }
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
