import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { query, execute } from "../../shared/db";
import { HttpError } from "../../shared/httpError";
import { isUuid } from "../../shared/validation";

function getUserId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string | undefined {
  return event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;
}

export async function getNotifications(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event);
  if (!userId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const rows = await query(
    `SELECT id, type, title, message, is_read, created_at
     FROM notifications WHERE user_id = :userId::uuid ORDER BY created_at DESC LIMIT 50`,
    { userId }
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        message: r.message,
        isRead: r.is_read,
        createdAt: r.created_at,
      }))
    ),
  };
}

export async function markNotificationRead(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event);
  if (!userId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const notificationId = event.pathParameters?.notificationId;
  if (!isUuid(notificationId)) throw new HttpError(400, "Invalid notificationId");

  const updated = await execute(
    `UPDATE notifications SET is_read = true WHERE id = :notificationId::uuid AND user_id = :userId::uuid`,
    { notificationId, userId }
  );
  if (updated === 0) {
    throw new HttpError(404, "Notification not found");
  }

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
}

export async function markAllNotificationsRead(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event);
  if (!userId) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  await execute(`UPDATE notifications SET is_read = true WHERE user_id = :userId::uuid AND is_read = false`, {
    userId,
  });

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
}
