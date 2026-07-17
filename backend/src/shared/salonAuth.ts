import { query } from "./db";
import { HttpError } from "./httpError";

// Shared "does this caller own a salon" scoping check, used by every
// salon-owner-only handler (visits, client list, reward management). Callers
// that need more than just the id (e.g. reward_multiplier) query the salons
// table themselves instead of using this.
export async function requireOwnedSalonId(ownerId: string): Promise<string> {
  const rows = await query(`SELECT id FROM salons WHERE owner_user_id = :ownerId::uuid`, { ownerId });
  const salon = rows[0];
  if (!salon) {
    throw new HttpError(403, "Only salon owners can perform this action");
  }
  return salon.id as string;
}
