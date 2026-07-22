import { query } from "./db";
import { HttpError } from "./httpError";

export interface ResolvedDiscount {
  discountedPrice: number;
  discountPercent: number;
}

// Shared by createPaymentIntent (read-only preview, no lock - Stripe hasn't
// been charged yet) and createAppointment (the real, transactional check
// that actually marks the redemption used). Both call this with the same
// inputs so the discounted amount Stripe charged and the amount
// createAppointment verifies against always agree - see the comment in
// createAppointment for why a mismatch there rejects the booking outright.
export async function resolveDiscount(
  clientId: string,
  salonId: string,
  redemptionId: string,
  servicePrice: number,
  tx?: string,
  forUpdate = false
): Promise<ResolvedDiscount> {
  const rows = await query(
    `SELECT used_at, discount_percent
     FROM redemptions
     WHERE id = :redemptionId::uuid AND client_id = :clientId::uuid AND salon_id = :salonId::uuid
     ${forUpdate ? "FOR UPDATE" : ""}`,
    { redemptionId, clientId, salonId },
    tx
  );
  const row = rows[0];
  if (!row) throw new HttpError(404, "Redeemed reward not found");
  if (row.used_at) throw new HttpError(400, "This redeemed reward has already been used");
  // Snapshotted at redemption time (see redeemReward.ts) - deliberately not
  // re-read from the live rewards row, which could have been edited since.
  const discountPercent = row.discount_percent as number | null;
  if (discountPercent === null) {
    throw new HttpError(400, "This redeemed reward isn't a discount that can be applied to a booking");
  }

  const discountedPrice = Math.round(servicePrice * (100 - discountPercent)) / 100;
  return { discountedPrice, discountPercent };
}
