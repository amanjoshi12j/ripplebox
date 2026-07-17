import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { getSalons } from "./handlers/salons";
import { getMe, updateMe, updateMyAvatar } from "./handlers/me";
import { getSalonRewards } from "./handlers/salonRewards";
import { redeemReward } from "./handlers/redeemReward";
import { getSalonMe, updateSalonMe, updateSalonLogo } from "./handlers/salonMe";
import { logVisit } from "./handlers/visits";
import { getSalonClients } from "./handlers/salonClients";
import {
  getSalonRewardsManage,
  createSalonReward,
  updateSalonReward,
  deleteSalonReward,
} from "./handlers/salonRewardsManage";
import {
  getSalonServicesManage,
  createSalonService,
  updateSalonService,
  deleteSalonService,
} from "./handlers/salonServicesManage";
import { applyReferral, getMyReferrals } from "./handlers/referrals";
import { getSalonCampaigns, createSalonCampaign, updateSalonCampaign } from "./handlers/campaigns";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "./handlers/notifications";
import { getSalonReferralAnalytics } from "./handlers/referralAnalytics";
import { getSalonDashboardStats } from "./handlers/dashboardStats";
import { getMyFavorites, addFavorite, removeFavorite } from "./handlers/favorites";
import {
  createAppointment,
  getMyAppointments,
  getSalonAppointments,
  updateSalonAppointmentStatus,
  cancelMyAppointment,
} from "./handlers/appointments";
import { createPaymentIntent } from "./handlers/payments";
import { getUploadUrl } from "./handlers/uploads";
import { HttpError } from "../shared/httpError";

type RouteHandler = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => Promise<APIGatewayProxyResultV2>;

// Keyed by API Gateway's routeKey ("METHOD /path/{param}" - the route
// template, not the resolved path), which HTTP API payload format 2.0
// includes on every event. Using it directly means route params like
// {salonId} just work via event.pathParameters, with no path-matching code
// of our own. API Gateway defines the actual routes (and per-route auth) in
// template.yaml; this table just keeps handler code organized by resource
// instead of splitting into one Lambda per route.
const routes: Record<string, RouteHandler> = {
  "GET /salons": getSalons,
  "GET /me": getMe,
  "PATCH /me": updateMe,
  "GET /salons/{salonId}/rewards": getSalonRewards,
  "POST /rewards/redeem": redeemReward,
  "GET /salon/me": getSalonMe,
  "PATCH /salon/me": updateSalonMe,
  "POST /visits": logVisit,
  "GET /salon/clients": getSalonClients,
  "GET /salon/rewards": getSalonRewardsManage,
  "POST /salon/rewards": createSalonReward,
  "PATCH /salon/rewards/{rewardId}": updateSalonReward,
  "DELETE /salon/rewards/{rewardId}": deleteSalonReward,
  "GET /salon/services": getSalonServicesManage,
  "POST /salon/services": createSalonService,
  "PATCH /salon/services/{serviceId}": updateSalonService,
  "DELETE /salon/services/{serviceId}": deleteSalonService,
  "POST /referrals/apply": applyReferral,
  "GET /me/referrals": getMyReferrals,
  "GET /salon/campaigns": getSalonCampaigns,
  "POST /salon/campaigns": createSalonCampaign,
  "PATCH /salon/campaigns/{campaignId}": updateSalonCampaign,
  "GET /notifications": getNotifications,
  "PATCH /notifications/{notificationId}/read": markNotificationRead,
  "PATCH /notifications/read-all": markAllNotificationsRead,
  "GET /salon/referral-analytics": getSalonReferralAnalytics,
  "GET /salon/dashboard-stats": getSalonDashboardStats,
  "GET /me/favorites": getMyFavorites,
  "POST /favorites/{salonId}": addFavorite,
  "DELETE /favorites/{salonId}": removeFavorite,
  "POST /appointments": createAppointment,
  "GET /me/appointments": getMyAppointments,
  "GET /salon/appointments": getSalonAppointments,
  "PATCH /salon/appointments/{appointmentId}": updateSalonAppointmentStatus,
  "PATCH /appointments/{appointmentId}/cancel": cancelMyAppointment,
  "POST /payments/create-intent": createPaymentIntent,
  "POST /uploads/presign": getUploadUrl,
  "PATCH /me/avatar": updateMyAvatar,
  "PATCH /salon/me/logo": updateSalonLogo,
};

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const routeHandler = routes[event.routeKey];

  if (!routeHandler) {
    return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
  }

  try {
    return await routeHandler(event);
  } catch (err) {
    if (err instanceof HttpError) {
      return { statusCode: err.statusCode, body: JSON.stringify({ error: err.message }) };
    }
    console.error("Handler error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
}
