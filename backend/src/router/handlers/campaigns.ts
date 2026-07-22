import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query, execute } from "../../shared/db";
import { HttpError } from "../../shared/httpError";
import { requireOwnedSalonId } from "../../shared/salonAuth";
import { isUuid } from "../../shared/validation";

const TYPES = new Set(["referral", "loyalty"]);

function getOwnerId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string | undefined {
  return event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
}

async function validateOwnedService(salonId: string, serviceId: string): Promise<string> {
  const rows = await query(
    `SELECT name FROM salon_services WHERE id = :serviceId::uuid AND salon_id = :salonId::uuid`,
    { serviceId, salonId }
  );
  if (!rows[0]) throw new HttpError(404, "Service not found");
  return rows[0].name as string;
}

interface CampaignInput {
  name: string;
  type: string;
  discountPercent: number;
  serviceId: string | null;
  visitThreshold: number | null;
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
  // Required for every campaign now - this is the entire mechanic (see
  // campaignDiscount.ts), not a decorative label like it used to be.
  if (
    typeof b.discountPercent !== "number" ||
    !Number.isInteger(b.discountPercent) ||
    b.discountPercent <= 0 ||
    b.discountPercent > 100
  ) {
    throw new HttpError(400, "discountPercent is required and must be 1-100");
  }
  if (b.serviceId !== null && b.serviceId !== undefined && !isUuid(b.serviceId)) {
    throw new HttpError(400, "serviceId must be a valid id or null");
  }
  let visitThreshold: number | null = null;
  if (b.type === "loyalty") {
    if (
      typeof b.visitThreshold !== "number" ||
      !Number.isInteger(b.visitThreshold) ||
      b.visitThreshold <= 0 ||
      b.visitThreshold > 1000
    ) {
      throw new HttpError(400, "visitThreshold is required for loyalty campaigns and must be a positive integer");
    }
    visitThreshold = b.visitThreshold;
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
    discountPercent: b.discountPercent,
    serviceId: (b.serviceId as string | null | undefined) ?? null,
    visitThreshold,
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
    serviceId: r.service_id,
    serviceName: r.service_name,
    visitThreshold: r.visit_threshold,
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
    `SELECT c.id, c.name, c.type, c.discount_percent, c.service_id, sv.name AS service_name,
            c.visit_threshold, c.status, c.start_date, c.end_date, c.redemptions
     FROM campaigns c
     LEFT JOIN salon_services sv ON sv.id = c.service_id
     WHERE c.salon_id = :salonId::uuid ORDER BY c.created_at DESC`,
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
  const serviceName = input.serviceId ? await validateOwnedService(salonId, input.serviceId) : null;

  const rows = await query(
    `INSERT INTO campaigns (salon_id, name, type, discount_percent, service_id, visit_threshold, start_date, end_date)
     VALUES (:salonId::uuid, :name, :type::campaign_type, :discountPercent, :serviceId::uuid, :visitThreshold, :startDate::date, :endDate::date)
     RETURNING id, name, type, discount_percent, service_id, visit_threshold, status, start_date, end_date, redemptions`,
    { salonId, ...input }
  );

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toResponse({ ...rows[0], service_name: serviceName })),
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
  const serviceName = input.serviceId ? await validateOwnedService(salonId, input.serviceId) : null;

  const updated = await execute(
    `UPDATE campaigns
     SET name = :name, type = :type::campaign_type, discount_percent = :discountPercent,
         service_id = :serviceId::uuid, visit_threshold = :visitThreshold,
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
    body: JSON.stringify({ id: campaignId, status, ...input, serviceName }),
  };
}
