import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query } from "../../shared/db";
import { HttpError } from "../../shared/httpError";
import { getStripeClient } from "../../shared/stripe";
import { isUuid } from "../../shared/validation";

export async function createPaymentIntent(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const clientId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!clientId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  let salonId: unknown, serviceId: unknown;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    ({ salonId, serviceId } = body);
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  if (!isUuid(salonId) || !isUuid(serviceId)) {
    throw new HttpError(400, "salonId and serviceId must be valid ids");
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
  const amount = Number(service.price);

  const stripe = getStripeClient();
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "aud",
    metadata: { salonId: salonId as string, serviceId: serviceId as string, clientId },
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
