import { query, execute } from "./db";
import { HttpError } from "./httpError";

export interface CampaignMatch {
  campaignId: string;
  campaignName: string;
  discountPercent: number;
  role: "referred" | "referrer" | "loyalty";
  referralId?: string;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// Read-only lookup - finds the single best (highest-percent) active
// campaign discount this client currently qualifies for at this
// salon+service, without marking anything as used. Consuming it (locking
// and marking the underlying referral row, if any) happens separately in
// consumeCampaignMatch, called only once a booking is actually confirmed.
export async function findBestCampaignMatch(
  clientId: string,
  salonId: string,
  serviceId: string
): Promise<CampaignMatch | null> {
  const campaigns = await query(
    `SELECT id, name, type, discount_percent, visit_threshold
     FROM campaigns
     WHERE salon_id = :salonId::uuid AND status = 'active'
       AND :today::date BETWEEN start_date AND end_date
       AND (service_id IS NULL OR service_id = :serviceId::uuid)`,
    { salonId, serviceId, today: todayUtc() }
  );
  if (campaigns.length === 0) return null;

  let best: CampaignMatch | null = null;
  const consider = (match: CampaignMatch) => {
    if (!best || match.discountPercent > best.discountPercent) best = match;
  };

  const referralCampaigns = campaigns.filter((c) => c.type === "referral");
  if (referralCampaigns.length > 0) {
    const [referredRows, referrerRows] = await Promise.all([
      query(
        `SELECT id FROM referrals
         WHERE referred_id = :clientId::uuid AND salon_id = :salonId::uuid AND referred_bonus_used_at IS NULL`,
        { clientId, salonId }
      ),
      query(
        `SELECT id FROM referrals
         WHERE referrer_id = :clientId::uuid AND salon_id = :salonId::uuid
           AND status = 'completed' AND referrer_bonus_used_at IS NULL`,
        { clientId, salonId }
      ),
    ]);

    if (referredRows[0] || referrerRows[0]) {
      const priorCountRows = await query(
        `SELECT count(*) AS c FROM appointments
         WHERE client_id = :clientId::uuid AND salon_id = :salonId::uuid AND status NOT IN ('cancelled', 'declined')`,
        { clientId, salonId }
      );
      const priorCount = Number(priorCountRows[0].c);

      // The referred friend's discount only ever applies to their very
      // first booking at this salon - matches the "your friend gets X% off
      // their first visit" framing, distinct from the referrer's ongoing
      // bonus below (which needs the referral to have actually completed).
      if (referredRows[0] && priorCount === 0) {
        for (const c of referralCampaigns) {
          consider({
            campaignId: c.id as string,
            campaignName: c.name as string,
            discountPercent: c.discount_percent as number,
            role: "referred",
            referralId: referredRows[0].id as string,
          });
        }
      }
      if (referrerRows[0]) {
        for (const c of referralCampaigns) {
          consider({
            campaignId: c.id as string,
            campaignName: c.name as string,
            discountPercent: c.discount_percent as number,
            role: "referrer",
            referralId: referrerRows[0].id as string,
          });
        }
      }
    }
  }

  const loyaltyCampaigns = campaigns.filter((c) => c.type === "loyalty");
  if (loyaltyCampaigns.length > 0) {
    const priorCountRows = await query(
      `SELECT count(*) AS c FROM appointments
       WHERE client_id = :clientId::uuid AND salon_id = :salonId::uuid AND status NOT IN ('cancelled', 'declined')`,
      { clientId, salonId }
    );
    // This booking would be their Nth visit at this salon - a one-time
    // milestone check, not "50% off forever after visit 5".
    const visitNumber = Number(priorCountRows[0].c) + 1;
    for (const c of loyaltyCampaigns) {
      if ((c.visit_threshold as number) === visitNumber) {
        consider({
          campaignId: c.id as string,
          campaignName: c.name as string,
          discountPercent: c.discount_percent as number,
          role: "loyalty",
        });
      }
    }
  }

  return best;
}

// Marks a campaign match as actually used, once the booking it applies to
// is confirmed - called inside the same transaction as the appointment
// insert. Referral matches (referred/referrer) lock and re-verify their
// referral row right before marking it, the same "preview, then lock+verify
// the exact same thing" discipline resolveDiscount uses for redemptions.
// Loyalty matches have no per-use row to lock - the visit-count check is
// naturally one-time, since a client's Nth appointment can only ever be
// created once.
export async function consumeCampaignMatch(match: CampaignMatch, tx: string): Promise<void> {
  if (match.role !== "loyalty" && match.referralId) {
    const column = match.role === "referred" ? "referred_bonus_used_at" : "referrer_bonus_used_at";
    const rows = await query(
      `SELECT ${column} AS used_at FROM referrals WHERE id = :id::uuid FOR UPDATE`,
      { id: match.referralId },
      tx
    );
    if (!rows[0]) throw new HttpError(404, "Referral not found");
    if (rows[0].used_at) throw new HttpError(400, "This referral bonus has already been used");
    await execute(`UPDATE referrals SET ${column} = now() WHERE id = :id::uuid`, { id: match.referralId }, tx);
  }
  await execute(`UPDATE campaigns SET redemptions = redemptions + 1 WHERE id = :id::uuid`, { id: match.campaignId }, tx);
}
