import { query } from "./db";
import { HttpError } from "./httpError";
import { findBestCampaignMatch, consumeCampaignMatch, type CampaignMatch } from "./campaignDiscount";

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

export interface BestDiscount {
  discountedPrice: number;
  discountPercent: number;
  source: "redemption" | "campaign" | "none";
  campaignMatch?: CampaignMatch;
}

// Combines an explicitly-selected reward redemption with any automatically-
// qualifying campaign discount (referral bonus / loyalty milestone, see
// campaignDiscount.ts) and picks whichever gives the bigger discount - the
// two never stack. If the campaign wins, the client's selected redemption
// (if any) is left completely untouched/unused, so they don't lose it for
// nothing just because a better automatic discount applied instead.
export async function resolveBestDiscount(
  clientId: string,
  salonId: string,
  serviceId: string,
  servicePrice: number,
  redemptionId: string | null
): Promise<BestDiscount> {
  const [redemption, campaignMatch] = await Promise.all([
    redemptionId ? resolveDiscount(clientId, salonId, redemptionId, servicePrice) : Promise.resolve(null),
    findBestCampaignMatch(clientId, salonId, serviceId),
  ]);

  const redemptionPct = redemption?.discountPercent ?? -1;
  const campaignPct = campaignMatch?.discountPercent ?? -1;

  if (campaignMatch && campaignPct > redemptionPct) {
    const discountedPrice = Math.round(servicePrice * (100 - campaignMatch.discountPercent)) / 100;
    return { discountedPrice, discountPercent: campaignMatch.discountPercent, source: "campaign", campaignMatch };
  }
  if (redemption) {
    return { discountedPrice: redemption.discountedPrice, discountPercent: redemption.discountPercent, source: "redemption" };
  }
  return { discountedPrice: servicePrice, discountPercent: 0, source: "none" };
}

// Consumes whichever discount resolveBestDiscount picked, once the booking
// is confirmed - called inside the appointment-insert transaction. Only
// handles the campaign side: redemption consumption still goes through the
// existing resolveDiscount(forUpdate=true) + UPDATE redemptions call sites
// in appointments.ts unchanged, since that's the only caller and duplicating
// the lock here would just be another place to keep in sync.
export async function consumeBestDiscount(best: BestDiscount, tx: string): Promise<void> {
  if (best.source === "campaign" && best.campaignMatch) {
    await consumeCampaignMatch(best.campaignMatch, tx);
  }
}
