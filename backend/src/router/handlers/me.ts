import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query, execute } from "../../shared/db";
import { HttpError } from "../../shared/httpError";

async function fetchMeResponse(sub: string) {
  const users = await query(
    `SELECT id, email, name, phone, avatar_url, referral_code, created_at
     FROM users WHERE id = :id::uuid`,
    { id: sub }
  );
  const user = users[0];
  if (!user) return null;

  const points = await query(
    `SELECT salon_id, points FROM salon_points_balance WHERE client_id = :id::uuid`,
    { id: sub }
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatar: user.avatar_url,
    referralCode: user.referral_code,
    memberSince: user.created_at,
    salonPoints: points.map((p) => ({ salonId: p.salon_id, points: p.points })),
  };
}

export async function getMe(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const sub = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!sub) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const me = await fetchMeResponse(sub);
  if (!me) {
    return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };
  }

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(me) };
}

export async function updateMe(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const sub = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!sub) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let name: unknown;
  let phone: unknown;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    name = body.name;
    phone = body.phone;
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  // Email is intentionally not editable here - it's the Cognito login
  // username, so changing it needs a separate verify-new-email flow, not a
  // plain field update.
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new HttpError(400, "name is required");
  }
  if (phone !== null && phone !== undefined && typeof phone !== "string") {
    throw new HttpError(400, "phone must be a string or null");
  }

  await execute(
    `UPDATE users SET name = :name, phone = :phone WHERE id = :id::uuid`,
    { id: sub, name: name.trim(), phone: (phone as string | null) ?? null }
  );

  const me = await fetchMeResponse(sub);
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(me) };
}

export async function updateMyAvatar(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const sub = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!sub) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let avatarUrl: unknown;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    avatarUrl = body.avatarUrl;
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  if (typeof avatarUrl !== "string" || avatarUrl.trim().length === 0) {
    throw new HttpError(400, "avatarUrl is required");
  }

  await execute(`UPDATE users SET avatar_url = :avatarUrl WHERE id = :id::uuid`, { id: sub, avatarUrl });

  const me = await fetchMeResponse(sub);
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(me) };
}
