import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { randomUUID } from "node:crypto";
import { query, execute, runInTransaction } from "../../shared/db";
import { HttpError } from "../../shared/httpError";
import { isUuid } from "../../shared/validation";
import { insertNotification } from "../../shared/notifications";

export async function redeemReward(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const clientId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!clientId) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let rewardId: unknown;
  try {
    rewardId = event.body ? JSON.parse(event.body).rewardId : undefined;
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  if (!isUuid(rewardId)) {
    throw new HttpError(400, "Missing or invalid rewardId");
  }

  const result = await runInTransaction(async (tx) => {
    // Lock the reward row first, then the balance row - redeemReward is the
    // only place that touches both, so a consistent lock order here is
    // enough on its own to rule out a deadlock against a concurrent
    // redemption.
    const rewardRows = await query(
      `SELECT r.id, r.salon_id, r.title, r.points_cost, r.discount_percent, r.is_active, r.expires_at,
              p.name AS free_product_name
       FROM rewards r
       LEFT JOIN salon_products p ON p.id = r.free_product_id
       WHERE r.id = :rewardId::uuid
       FOR UPDATE OF r`,
      { rewardId },
      tx
    );
    const reward = rewardRows[0];
    if (!reward) {
      throw new HttpError(404, "Reward not found");
    }
    if (!reward.is_active) {
      throw new HttpError(400, "This reward is no longer available");
    }
    if (reward.expires_at && new Date(reward.expires_at as string) <= new Date()) {
      throw new HttpError(400, "This reward has expired");
    }

    const salonId = reward.salon_id as string;
    const pointsCost = reward.points_cost as number;

    // Row lock on the balance is what prevents two simultaneous redemption
    // requests from both reading the same starting balance and double-spending
    // it - whichever request's transaction commits first, the second one's
    // SELECT blocks until then and re-reads the now-updated balance.
    const balanceRows = await query(
      `SELECT points FROM salon_points_balance WHERE client_id = :clientId::uuid AND salon_id = :salonId::uuid FOR UPDATE`,
      { clientId, salonId },
      tx
    );
    const currentPoints = (balanceRows[0]?.points as number | undefined) ?? 0;

    if (currentPoints < pointsCost) {
      throw new HttpError(
        400,
        `Insufficient points at this salon: you have ${currentPoints}, this reward costs ${pointsCost}`
      );
    }

    const redemptionId = randomUUID();

    await execute(
      `UPDATE salon_points_balance
       SET points = points - :pointsCost, updated_at = now()
       WHERE client_id = :clientId::uuid AND salon_id = :salonId::uuid`,
      { clientId, salonId, pointsCost },
      tx
    );

    await execute(
      `INSERT INTO point_transactions (client_id, salon_id, type, points_delta, reference_id, note)
       VALUES (:clientId::uuid, :salonId::uuid, 'redeem', :negCost, :redemptionId::uuid, :note)`,
      {
        clientId,
        salonId,
        negCost: -pointsCost,
        redemptionId,
        note: `Redeemed: ${reward.title}`,
      },
      tx
    );

    await execute(
      `INSERT INTO redemptions (id, client_id, salon_id, reward_id, points_spent, discount_percent, free_product_name)
       VALUES (:redemptionId::uuid, :clientId::uuid, :salonId::uuid, :rewardId::uuid, :pointsCost, :discountPercent, :freeProductName)`,
      {
        redemptionId,
        clientId,
        salonId,
        rewardId,
        pointsCost,
        discountPercent: (reward.discount_percent as number | null) ?? null,
        freeProductName: (reward.free_product_name as string | null) ?? null,
      },
      tx
    );

    const salonRows = await query(
      `SELECT name, owner_user_id FROM salons WHERE id = :salonId::uuid`,
      { salonId },
      tx
    );
    const salonName = salonRows[0]?.name as string | undefined;
    const ownerUserId = salonRows[0]?.owner_user_id as string | undefined;

    await insertNotification(
      clientId,
      "reward",
      "Reward redeemed!",
      `You redeemed "${reward.title}" at ${salonName}.`,
      tx
    );
    if (ownerUserId) {
      await insertNotification(
        ownerUserId,
        "reward",
        "Reward redeemed",
        `A client redeemed "${reward.title}".`,
        tx
      );
    }

    return {
      redemptionId,
      rewardId: reward.id,
      rewardTitle: reward.title,
      salonId,
      pointsSpent: pointsCost,
      pointsRemaining: currentPoints - pointsCost,
    };
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  };
}

export async function getMyRedemptions(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const clientId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!clientId) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const salonId = event.queryStringParameters?.salonId;
  if (salonId && !isUuid(salonId)) {
    throw new HttpError(400, "Invalid salonId");
  }

  const rows = await query(
    `SELECT red.id, red.salon_id, s.name AS salon_name, red.reward_id, rew.title AS reward_title,
            red.discount_percent, red.free_product_name, red.points_spent, red.redeemed_at, red.used_at,
            red.applied_appointment_id
     FROM redemptions red
     JOIN salons s ON s.id = red.salon_id
     JOIN rewards rew ON rew.id = red.reward_id
     WHERE red.client_id = :clientId::uuid ${salonId ? "AND red.salon_id = :salonId::uuid" : ""}
     ORDER BY red.redeemed_at DESC`,
    salonId ? { clientId, salonId } : { clientId }
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        salonId: r.salon_id,
        salonName: r.salon_name,
        rewardId: r.reward_id,
        rewardTitle: r.reward_title,
        discountPercent: r.discount_percent,
        freeProductName: r.free_product_name,
        pointsSpent: r.points_spent,
        redeemedAt: r.redeemed_at,
        usedAt: r.used_at,
        appliedAppointmentId: r.applied_appointment_id,
      }))
    ),
  };
}
