import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query, execute } from "../../shared/db";
import { HttpError } from "../../shared/httpError";
import { requireOwnedSalonId } from "../../shared/salonAuth";
import { isUuid } from "../../shared/validation";

async function validateOwnedProduct(salonId: string, productId: string): Promise<void> {
  const rows = await query(
    `SELECT id FROM salon_products WHERE id = :productId::uuid AND salon_id = :salonId::uuid`,
    { productId, salonId }
  );
  if (!rows[0]) throw new HttpError(404, "Product not found");
}

const CATEGORIES = new Set(["discount", "freebie", "credit"]);

function getOwnerId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string | undefined {
  return event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
}

interface RewardInput {
  title: string;
  description: string | null;
  pointsCost: number;
  category: string | null;
  discountPercent: number | null;
  freeProductId: string | null;
}

function parseRewardInput(body: unknown): RewardInput {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.title !== "string" || b.title.trim().length === 0) {
    throw new HttpError(400, "title is required");
  }
  if (typeof b.pointsCost !== "number" || !Number.isInteger(b.pointsCost) || b.pointsCost <= 0) {
    throw new HttpError(400, "pointsCost must be a positive integer");
  }
  if (b.category !== undefined && b.category !== null && !CATEGORIES.has(b.category as string)) {
    throw new HttpError(400, `category must be one of: ${[...CATEGORIES].join(", ")}`);
  }
  let discountPercent: number | null = null;
  if (b.category === "discount") {
    // Required for discount rewards - without it, redeeming this reward
    // would spend real points and do nothing at booking time (the bug this
    // field exists to fix).
    if (
      typeof b.discountPercent !== "number" ||
      !Number.isInteger(b.discountPercent) ||
      b.discountPercent <= 0 ||
      b.discountPercent > 100
    ) {
      throw new HttpError(400, "discountPercent is required for discount rewards and must be 1-100");
    }
    discountPercent = b.discountPercent;
  }
  let freeProductId: string | null = null;
  if (b.category === "freebie") {
    // Required for freebie rewards, same reasoning as discountPercent above -
    // ownership (does this product actually belong to this salon) is
    // checked separately, once the caller's salonId is known.
    if (!isUuid(b.freeProductId)) {
      throw new HttpError(400, "freeProductId is required for freebie rewards");
    }
    freeProductId = b.freeProductId as string;
  }
  return {
    title: b.title,
    description: typeof b.description === "string" ? b.description : null,
    pointsCost: b.pointsCost,
    category: (b.category as string) ?? null,
    discountPercent,
    freeProductId,
  };
}

export async function getSalonRewardsManage(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const salonId = await requireOwnedSalonId(ownerId);

  const [rewards, redeemedRows] = await Promise.all([
    query(
      `SELECT r.id, r.title, r.description, r.points_cost, r.category, r.discount_percent,
              r.free_product_id, p.name AS free_product_name, r.is_active, r.expires_at
       FROM rewards r
       LEFT JOIN salon_products p ON p.id = r.free_product_id
       WHERE r.salon_id = :salonId::uuid ORDER BY r.created_at DESC`,
      { salonId }
    ),
    query(`SELECT count(*) AS c FROM redemptions WHERE salon_id = :salonId::uuid`, { salonId }),
  ]);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rewards: rewards.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        pointsCost: r.points_cost,
        category: r.category,
        discountPercent: r.discount_percent,
        freeProductId: r.free_product_id,
        freeProductName: r.free_product_name,
        isActive: r.is_active,
        expiresAt: r.expires_at,
      })),
      totalRedeemed: redeemedRows[0].c,
    }),
  };
}

export async function createSalonReward(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  let input: RewardInput;
  try {
    input = parseRewardInput(event.body ? JSON.parse(event.body) : {});
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "Invalid request body");
  }

  const salonId = await requireOwnedSalonId(ownerId);
  if (input.freeProductId) await validateOwnedProduct(salonId, input.freeProductId);

  const rows = await query(
    `INSERT INTO rewards (salon_id, title, description, points_cost, category, discount_percent, free_product_id, is_active)
     VALUES (:salonId::uuid, :title, :description, :pointsCost, :category, :discountPercent, :freeProductId::uuid, true)
     RETURNING id, title, description, points_cost, category, discount_percent, free_product_id, is_active, expires_at`,
    { salonId, ...input }
  );
  const r = rows[0];

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: r.id,
      title: r.title,
      description: r.description,
      pointsCost: r.points_cost,
      category: r.category,
      discountPercent: r.discount_percent,
      freeProductId: r.free_product_id,
      isActive: r.is_active,
      expiresAt: r.expires_at,
    }),
  };
}

export async function updateSalonReward(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const rewardId = event.pathParameters?.rewardId;
  if (!isUuid(rewardId)) throw new HttpError(400, "Invalid rewardId");

  let input: RewardInput;
  let isActive: boolean;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    input = parseRewardInput(body);
    if (typeof body.isActive !== "boolean") throw new HttpError(400, "isActive must be a boolean");
    isActive = body.isActive;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "Invalid request body");
  }

  const salonId = await requireOwnedSalonId(ownerId);
  if (input.freeProductId) await validateOwnedProduct(salonId, input.freeProductId);

  // Scoping the UPDATE itself to salon_id (not just checking rewardId
  // exists) is what stops a salon owner editing a reward that belongs to
  // someone else's salon - same data-scoping pattern used throughout.
  const updated = await execute(
    `UPDATE rewards
     SET title = :title, description = :description, points_cost = :pointsCost,
         category = :category, discount_percent = :discountPercent, free_product_id = :freeProductId::uuid,
         is_active = :isActive
     WHERE id = :rewardId::uuid AND salon_id = :salonId::uuid`,
    { rewardId, salonId, isActive, ...input }
  );
  if (updated === 0) {
    throw new HttpError(404, "Reward not found");
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: rewardId, ...input, isActive }),
  };
}

export async function deleteSalonReward(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const rewardId = event.pathParameters?.rewardId;
  if (!isUuid(rewardId)) throw new HttpError(400, "Invalid rewardId");

  const salonId = await requireOwnedSalonId(ownerId);

  const ownedRows = await query(
    `SELECT id FROM rewards WHERE id = :rewardId::uuid AND salon_id = :salonId::uuid`,
    { rewardId, salonId }
  );
  if (!ownedRows[0]) {
    throw new HttpError(404, "Reward not found");
  }

  // rewards.id has no ON DELETE CASCADE from redemptions (deliberately -
  // redemption history should survive a reward being removed from the
  // catalog), so a reward that's ever been redeemed can't be hard-deleted.
  // Deactivating instead (via PATCH) is the correct move for those.
  const redeemedRows = await query(
    `SELECT count(*) AS c FROM redemptions WHERE reward_id = :rewardId::uuid`,
    { rewardId }
  );
  if ((redeemedRows[0].c as number) > 0) {
    throw new HttpError(400, "Can't delete a reward that's already been redeemed - deactivate it instead");
  }

  await execute(`DELETE FROM rewards WHERE id = :rewardId::uuid`, { rewardId });

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: true }) };
}
