import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { randomUUID } from "node:crypto";
import { HttpError } from "../../shared/httpError";
import { requireOwnedSalonId } from "../../shared/salonAuth";
import { createUploadUrl, extensionFor } from "../../shared/s3";

const KINDS = new Set(["avatar", "salon-logo", "salon-product"]);

export async function getUploadUrl(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const callerId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!callerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  let kind: unknown, contentType: unknown;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    ({ kind, contentType } = body);
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  if (typeof kind !== "string" || !KINDS.has(kind)) {
    throw new HttpError(400, `kind must be one of: ${[...KINDS].join(", ")}`);
  }
  const ext = typeof contentType === "string" ? extensionFor(contentType) : null;
  if (!ext) {
    throw new HttpError(400, "contentType must be one of: image/jpeg, image/png, image/webp");
  }

  // avatar uploads are scoped to the caller's own id; salon-logo and
  // salon-product uploads require the caller to actually own a salon - same
  // ownership-scoping pattern used throughout (requireOwnedSalonId).
  let key: string;
  if (kind === "avatar") {
    key = `avatars/${callerId}/${randomUUID()}.${ext}`;
  } else if (kind === "salon-product") {
    key = `salons/${await requireOwnedSalonId(callerId)}/products/${randomUUID()}.${ext}`;
  } else {
    key = `salons/${await requireOwnedSalonId(callerId)}/${randomUUID()}.${ext}`;
  }

  const { uploadUrl, publicUrl } = await createUploadUrl(key, contentType as string);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadUrl, publicUrl }),
  };
}
