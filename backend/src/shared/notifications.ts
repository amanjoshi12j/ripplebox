import { execute } from "./db";

export type NotificationType = "reward" | "referral" | "appointment" | "alert" | "info";

// Fire-and-forget from within an existing transaction - notification
// delivery is a side effect of the real event (visit logged, reward
// redeemed, referral completed), never something that should block or fail
// the underlying action, so callers don't need to handle errors specially
// here (they run inside the same runInTransaction as the real work, so a
// genuine DB failure still rolls everything back together).
export async function insertNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  transactionId?: string
): Promise<void> {
  await execute(
    `INSERT INTO notifications (user_id, type, title, message) VALUES (:userId::uuid, :type::notification_type, :title, :message)`,
    { userId, type, title, message },
    transactionId
  );
}
