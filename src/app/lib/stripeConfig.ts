import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Publishable keys are not secret (that's the whole point of the
// publishable/secret key split - see backend/src/shared/stripe.ts for the
// secret key, which never reaches the frontend), so it's fine for this to
// live in an env var with no fallback rather than being hidden anywhere.
const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

let stripePromise: Promise<Stripe | null> | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(PUBLISHABLE_KEY);
}

export function getStripe(): Promise<Stripe | null> {
  if (!PUBLISHABLE_KEY) return Promise.resolve(null);
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY);
  return stripePromise;
}
