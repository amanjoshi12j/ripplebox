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

interface ProductInput {
  name: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
}

function parseProductInput(body: unknown): ProductInput {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    throw new HttpError(400, "name is required");
  }
  if (typeof b.price !== "number" || !Number.isFinite(b.price) || b.price < 0) {
    throw new HttpError(400, "price must be a non-negative number");
  }
  return {
    name: b.name.trim(),
    price: b.price,
    description: typeof b.description === "string" ? b.description : null,
    imageUrl: typeof b.imageUrl === "string" ? b.imageUrl : null,
  };
}

export async function getSalonProductsManage(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const salonId = await requireOwnedSalonId(ownerId);

  const products = await query(
    `SELECT id, name, price, description, image_url FROM salon_products WHERE salon_id = :salonId::uuid ORDER BY created_at`,
    { salonId }
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        imageUrl: p.image_url,
      }))
    ),
  };
}

export async function createSalonProduct(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  let input: ProductInput;
  try {
    input = parseProductInput(event.body ? JSON.parse(event.body) : {});
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "Invalid request body");
  }

  const salonId = await requireOwnedSalonId(ownerId);

  const rows = await query(
    `INSERT INTO salon_products (salon_id, name, price, description, image_url)
     VALUES (:salonId::uuid, :name, :price, :description, :imageUrl)
     RETURNING id, name, price, description, image_url`,
    { salonId, ...input }
  );
  const p = rows[0];

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      imageUrl: p.image_url,
    }),
  };
}

export async function updateSalonProduct(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const productId = event.pathParameters?.productId;
  if (!isUuid(productId)) throw new HttpError(400, "Invalid productId");

  let input: ProductInput;
  try {
    input = parseProductInput(event.body ? JSON.parse(event.body) : {});
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "Invalid request body");
  }

  const salonId = await requireOwnedSalonId(ownerId);

  const updated = await execute(
    `UPDATE salon_products SET name = :name, price = :price, description = :description, image_url = :imageUrl
     WHERE id = :productId::uuid AND salon_id = :salonId::uuid`,
    { productId, salonId, ...input }
  );
  if (updated === 0) {
    throw new HttpError(404, "Product not found");
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: productId, ...input }),
  };
}

export async function deleteSalonProduct(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const productId = event.pathParameters?.productId;
  if (!isUuid(productId)) throw new HttpError(400, "Invalid productId");

  const salonId = await requireOwnedSalonId(ownerId);

  // Unlike rewards (which block delete once redeemed to protect audit
  // history), a freebie reward's product name is snapshotted onto the
  // redemption at redemption time (see redeemReward.ts) - so a product can
  // always be deleted without corrupting past redemption records. Any
  // reward still pointing at it just keeps free_product_id pointing at a
  // row that no longer exists... but rewards.free_product_id has no
  // ON DELETE action, so deleting a product a live reward still points to
  // fails with a plain FK error - acceptable for now (rare, and correctly
  // prevents silently breaking an active reward with no product behind it).
  const deleted = await execute(
    `DELETE FROM salon_products WHERE id = :productId::uuid AND salon_id = :salonId::uuid`,
    { productId, salonId }
  );
  if (deleted === 0) {
    throw new HttpError(404, "Product not found");
  }

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: true }) };
}
