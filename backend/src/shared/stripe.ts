import Stripe from "stripe";
import { HttpError } from "./httpError";

let client: Stripe | null = null;

// Lazily constructed so a missing STRIPE_SECRET_KEY (e.g. before test keys
// are wired up) only breaks the Pay Now path with a clear 503, not every
// cold start of the router Lambda.
export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new HttpError(503, "Card payments aren't configured yet - please choose Pay Later instead.");
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}
