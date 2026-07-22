import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query } from "../../shared/db";
import { HttpError } from "../../shared/httpError";
import { getStripeClient } from "../../shared/stripe";
import { isUuid } from "../../shared/validation";
import { resolveDiscount } from "../../shared/rewardDiscount";

export async function createPaymentIntent(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const clientId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!clientId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  let salonId: unknown, serviceId: unknown, redemptionId: unknown;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    ({ salonId, serviceId, redemptionId } = body);
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  if (!isUuid(salonId) || !isUuid(serviceId)) {
    throw new HttpError(400, "salonId and serviceId must be valid ids");
  }
  if (redemptionId !== undefined && redemptionId !== null && !isUuid(redemptionId)) {
    throw new HttpError(400, "redemptionId must be a valid id");
  }

  // The amount is always derived from the real service price server-side -
  // never trust a client-supplied amount here, or a tampered request could
  // pay $1 for a $200 service and still have a "succeeded" PaymentIntent.
  const rows = await query(
    `SELECT price FROM salon_services WHERE id = :serviceId::uuid AND salon_id = :salonId::uuid`,
    { serviceId, salonId }
  );
  const service = rows[0];
  if (!service) throw new HttpError(404, "Service not found");
  const servicePrice = Number(service.price);

  // Read-only preview here - no row lock, nothing marked used yet. The
  // redemption only actually gets consumed inside createAppointment's
  // transaction, once the booking (and for pay_now, the real charge) is
  // confirmed. A stale/raced preview just means createAppointment's own
  // check rejects the booking afterward - see the comment there.
  const amount = redemptionId
    ? (await resolveDiscount(clientId, salonId as string, redemptionId as string, servicePrice)).discountedPrice
    : servicePrice;

  const stripe = getStripeClient();
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "aud",
    metadata: {
      salonId: salonId as string,
      serviceId: serviceId as string,
      clientId,
      redemptionId: (redemptionId as string | undefined) ?? "",
    },
    automatic_payment_methods: { enabled: true },
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount,
    }),
  };
}
