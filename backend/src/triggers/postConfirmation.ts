import type { PostConfirmationTriggerEvent } from "aws-lambda";
import { randomBytes } from "node:crypto";
import { execute } from "../shared/db";

function generateReferralCode(name: string): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const prefix = name.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase() || "USER";
  return `${prefix}${suffix}`;
}

export async function handler(
  event: PostConfirmationTriggerEvent
): Promise<PostConfirmationTriggerEvent> {
  // Only react to a completed signup confirmation, not other PostConfirmation
  // trigger sources (e.g. admin-created users being force-confirmed).
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    return event;
  }

  const attrs = event.request.userAttributes;
  const sub = attrs.sub;
  const email = attrs.email;
  const name = attrs.name ?? email;
  const phone = attrs.phone_number ?? null;
  const role = (attrs["custom:role"] === "salon_owner" ? "salon_owner" : "client") as
    | "client"
    | "salon_owner";

  const referralCode = role === "client" ? generateReferralCode(name) : null;

  // Cognito retries PostConfirmation on certain errors, so this must be
  // idempotent - ON CONFLICT DO NOTHING plus checking whether a row was
  // actually inserted (not just "did the statement succeed") is what stops
  // a retry from also inserting a second salons row below. Deliberately no
  // conflict target specified (not "ON CONFLICT (id)") - Postgres only
  // suppresses errors for the exact constraint named, and this table has
  // two unique constraints (id, email) a concurrent retry could each hit;
  // a bare ON CONFLICT DO NOTHING covers either.
  const inserted = await execute(
    `INSERT INTO users (id, email, name, phone, role, referral_code)
     VALUES (:id::uuid, :email, :name, :phone, :role::user_role, :referralCode)
     ON CONFLICT DO NOTHING`,
    { id: sub, email, name, phone, role, referralCode }
  );

  if (inserted > 0 && role === "salon_owner") {
    const salonName = attrs["custom:salon_name"] || `${name}'s Salon`;
    const businessAddress = attrs["custom:business_address"] ?? null;

    await execute(
      `INSERT INTO salons (owner_user_id, name, address, email)
       VALUES (:ownerId::uuid, :name, :address, :email)`,
      { ownerId: sub, name: salonName, address: businessAddress, email }
    );
  }

  return event;
}
