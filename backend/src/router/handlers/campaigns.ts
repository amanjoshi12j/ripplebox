import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query, execute } from "../../shared/db";
import { HttpError } from "../../shared/httpError";
import { requireOwnedSalonId } from "../../shared/salonAuth";
import { isUuid } from "../../shared/validation";

const TYPES = new Set(["referral", "empty_appointment", "loyalty"]);

function getOwnerId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string | undefined {
  return event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
}

interface CampaignInput {
  name: string;
  type: string;
  discountPercent: number | null;
  startDate: string;
  endDate: string;
}

function parseCampaignInput(body: unknown): CampaignInput {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    throw new HttpError(400, "name is required");
  }
  if (typeof b.type !== "string" || !TYPES.has(b.type)) {
    throw new HttpError(400, `type must be one of: ${[...TYPES].join(", ")}`);
  }
  if (
    b.discountPercent !== null &&
    b.discountPercent !== undefined &&
    (typeof b.discountPercent !== "number" || b.discountPercent < 0 || b.discountPercent > 100)
  ) {
    throw new HttpError(400, "discountPercent must be a number between 0 and 100");
  }
  if (typeof b.startDate !== "string" || typeof b.endDate !== "string") {
    throw new HttpError(400, "startDate and endDate are required");
  }
  if (new Date(b.endDate) < new Date(b.startDate)) {
    throw new HttpError(400, "endDate can't be before startDate");
  }

  return {
    name: b.name.trim(),
    type: b.type,
    discountPercent: (b.discountPercent as number) ?? null,
    startDate: b.startDate,
    endDate: b.endDate,
  };
}

function toResponse(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    discountPercent: r.discount_percent,
    status: r.status,
    startDate: r.start_date,
    endDate: r.end_date,
    redemptions: r.redemptions,
  };
}

export async function getSalonCampaigns(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const salonId = await requireOwnedSalonId(ownerId);
  const rows = await query(
    `SELECT id, name, type, discount_percent, status, start_date, end_date, redemptions
     FROM campaigns WHERE salon_id = :salonId::uuid ORDER BY created_at DESC`,
    { salonId }
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows.map(toResponse)),
  };
}

export async function createSalonCampaign(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  let input: CampaignInput;
  try {
    input = parseCampaignInput(event.body ? JSON.parse(event.body) : {});
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "Invalid request body");
  }

  const salonId = await requireOwnedSalonId(ownerId);
  const rows = await query(
    `INSERT INTO campaigns (salon_id, name, type, discount_percent, start_date, end_date)
     VALUES (:salonId::uuid, :name, :type::campaign_type, :discountPercent, :startDate::date, :endDate::date)
     RETURNING id, name, type, discount_percent, status, start_date, end_date, redemptions`,
    { salonId, ...input }
  );

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toResponse(rows[0])),
  };
}

export async function updateSalonCampaign(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const ownerId = getOwnerId(event);
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const campaignId = event.pathParameters?.campaignId;
  if (!isUuid(campaignId)) throw new HttpError(400, "Invalid campaignId");

  let input: CampaignInput;
  let status: string;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    input = parseCampaignInput(body);
    if (body.status !== "active" && body.status !== "paused") {
      throw new HttpError(400, "status must be 'active' or 'paused'");
    }
    status = body.status;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "Invalid request body");
  }

  const salonId = await requireOwnedSalonId(ownerId);
  const updated = await execute(
    `UPDATE campaigns
     SET name = :name, type = :type::campaign_type, discount_percent = :discountPercent,
         start_date = :startDate::date, end_date = :endDate::date, status = :status::campaign_status
     WHERE id = :campaignId::uuid AND salon_id = :salonId::uuid`,
    { campaignId, salonId, status, ...input }
  );
  if (updated === 0) {
    throw new HttpError(404, "Campaign not found");
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: campaignId, status, ...input }),
  };
}
