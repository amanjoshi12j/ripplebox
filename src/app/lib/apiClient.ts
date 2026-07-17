const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://sc870tjzk6.execute-api.ap-southeast-2.amazonaws.com";

export interface MeResponse {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  referralCode: string | null;
  memberSince: string;
  salonPoints: { salonId: string; points: number }[];
}

export interface SalonServiceSummary {
  id: string;
  name: string;
  price: string;
}

export interface SalonSummary {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  image: string | null;
  rewardMultiplier: string;
  rating: string | null;
  reviewCount: number;
  services: SalonServiceSummary[];
}

async function apiFetch<T>(
  path: string,
  options: { idToken?: string; method?: string; body?: unknown } = {}
): Promise<T> {
  const { idToken, method = "GET", body } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error || `Request to ${path} failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getMe(idToken: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/me", { idToken });
}

export function updateMe(idToken: string, name: string, phone: string | null): Promise<MeResponse> {
  return apiFetch<MeResponse>("/me", { idToken, method: "PATCH", body: { name, phone } });
}

export function getSalons(): Promise<SalonSummary[]> {
  return apiFetch<SalonSummary[]>("/salons");
}

export interface RewardSummary {
  id: string;
  salonId: string;
  title: string;
  description: string | null;
  pointsCost: number;
  category: string | null;
  expiresAt: string | null;
}

export function getSalonRewards(salonId: string): Promise<RewardSummary[]> {
  return apiFetch<RewardSummary[]>(`/salons/${salonId}/rewards`);
}

export interface RedeemResult {
  redemptionId: string;
  rewardId: string;
  rewardTitle: string;
  salonId: string;
  pointsSpent: number;
  pointsRemaining: number;
}

export function redeemReward(idToken: string, rewardId: string): Promise<RedeemResult> {
  return apiFetch<RedeemResult>("/rewards/redeem", { idToken, method: "POST", body: { rewardId } });
}

export interface SalonMeResponse {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  image: string | null;
  rewardMultiplier: string;
  rating: string | null;
  reviewCount: number;
}

export function getSalonMe(idToken: string): Promise<SalonMeResponse> {
  return apiFetch<SalonMeResponse>("/salon/me", { idToken });
}

export interface SalonMeInput {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
}

export function updateSalonMe(idToken: string, input: SalonMeInput): Promise<SalonMeResponse> {
  return apiFetch<SalonMeResponse>("/salon/me", { idToken, method: "PATCH", body: input });
}

export function updateMyAvatar(idToken: string, avatarUrl: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/me/avatar", { idToken, method: "PATCH", body: { avatarUrl } });
}

export function updateSalonLogo(idToken: string, imageUrl: string): Promise<SalonMeResponse> {
  return apiFetch<SalonMeResponse>("/salon/me/logo", { idToken, method: "PATCH", body: { imageUrl } });
}

// Uploads a photo straight to S3 via a short-lived presigned URL (the image
// bytes never pass through our API/Lambda) and returns the resulting public
// URL, ready to hand to updateMyAvatar/updateSalonLogo.
export async function uploadImage(
  idToken: string,
  kind: "avatar" | "salon-logo",
  file: File
): Promise<string> {
  const { uploadUrl, publicUrl } = await apiFetch<{ uploadUrl: string; publicUrl: string }>(
    "/uploads/presign",
    { idToken, method: "POST", body: { kind, contentType: file.type } }
  );

  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error("Couldn't upload the image. Please try again.");
  }

  return publicUrl;
}

export interface SalonClient {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  loyaltyPoints: number;
  visits: number;
  totalSpent: string;
  lastVisit: string | null;
}

export function getSalonClients(idToken: string): Promise<SalonClient[]> {
  return apiFetch<SalonClient[]>("/salon/clients", { idToken });
}

export interface LogVisitResult {
  visitId: string;
  clientId: string;
  salonId: string;
  amountSpent: number;
  pointsEarned: number;
  newBalance: number;
}

export function logVisit(idToken: string, clientEmail: string, amountSpent: number): Promise<LogVisitResult> {
  return apiFetch<LogVisitResult>("/visits", { idToken, method: "POST", body: { clientEmail, amountSpent } });
}

export interface ManagedReward {
  id: string;
  title: string;
  description: string | null;
  pointsCost: number;
  category: string | null;
  isActive: boolean;
  expiresAt: string | null;
}

export interface SalonRewardsManageResponse {
  rewards: ManagedReward[];
  totalRedeemed: number;
}

export function getSalonRewardsManage(idToken: string): Promise<SalonRewardsManageResponse> {
  return apiFetch<SalonRewardsManageResponse>("/salon/rewards", { idToken });
}

export interface RewardInput {
  title: string;
  description?: string | null;
  pointsCost: number;
  category?: string | null;
}

export function createSalonReward(idToken: string, input: RewardInput): Promise<ManagedReward> {
  return apiFetch<ManagedReward>("/salon/rewards", { idToken, method: "POST", body: input });
}

export function updateSalonReward(
  idToken: string,
  rewardId: string,
  input: RewardInput & { isActive: boolean }
): Promise<ManagedReward> {
  return apiFetch<ManagedReward>(`/salon/rewards/${rewardId}`, { idToken, method: "PATCH", body: input });
}

export function deleteSalonReward(idToken: string, rewardId: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/salon/rewards/${rewardId}`, { idToken, method: "DELETE" });
}

export interface ManagedService {
  id: string;
  name: string;
  price: string;
}

export interface ServiceInput {
  name: string;
  price: number;
}

export function getSalonServicesManage(idToken: string): Promise<ManagedService[]> {
  return apiFetch<ManagedService[]>("/salon/services", { idToken });
}

export function createSalonService(idToken: string, input: ServiceInput): Promise<ManagedService> {
  return apiFetch<ManagedService>("/salon/services", { idToken, method: "POST", body: input });
}

export function updateSalonService(
  idToken: string,
  serviceId: string,
  input: ServiceInput
): Promise<ManagedService> {
  return apiFetch<ManagedService>(`/salon/services/${serviceId}`, { idToken, method: "PATCH", body: input });
}

export function deleteSalonService(idToken: string, serviceId: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/salon/services/${serviceId}`, { idToken, method: "DELETE" });
}

export interface ApplyReferralResult {
  id: string;
  status: string;
  createdAt: string;
}

export function applyReferral(
  idToken: string,
  referralCode: string,
  salonId: string
): Promise<ApplyReferralResult> {
  return apiFetch<ApplyReferralResult>("/referrals/apply", {
    idToken,
    method: "POST",
    body: { referralCode, salonId },
  });
}

export interface ReferralEntry {
  id: string;
  referredName: string;
  salonId: string;
  salonName: string;
  status: "pending" | "completed";
  pointsAwarded: number;
  createdAt: string;
  completedAt: string | null;
}

export interface MyReferralsResponse {
  referrals: ReferralEntry[];
  totalCompleted: number;
  totalPointsEarned: number;
}

export function getMyReferrals(idToken: string): Promise<MyReferralsResponse> {
  return apiFetch<MyReferralsResponse>("/me/referrals", { idToken });
}

export interface CampaignSummary {
  id: string;
  name: string;
  type: "referral" | "empty_appointment" | "loyalty";
  discountPercent: number | null;
  status: "active" | "paused";
  startDate: string;
  endDate: string;
  redemptions: number;
}

export interface CampaignInput {
  name: string;
  type: "referral" | "empty_appointment" | "loyalty";
  discountPercent: number | null;
  startDate: string;
  endDate: string;
}

export function getSalonCampaigns(idToken: string): Promise<CampaignSummary[]> {
  return apiFetch<CampaignSummary[]>("/salon/campaigns", { idToken });
}

export function createSalonCampaign(idToken: string, input: CampaignInput): Promise<CampaignSummary> {
  return apiFetch<CampaignSummary>("/salon/campaigns", { idToken, method: "POST", body: input });
}

export function updateSalonCampaign(
  idToken: string,
  campaignId: string,
  input: CampaignInput & { status: "active" | "paused" }
): Promise<CampaignSummary> {
  return apiFetch<CampaignSummary>(`/salon/campaigns/${campaignId}`, {
    idToken,
    method: "PATCH",
    body: input,
  });
}

export interface NotificationEntry {
  id: string;
  type: "reward" | "referral" | "appointment" | "alert" | "info";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function getNotifications(idToken: string): Promise<NotificationEntry[]> {
  return apiFetch<NotificationEntry[]>("/notifications", { idToken });
}

export function markNotificationRead(idToken: string, notificationId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/notifications/${notificationId}/read`, { idToken, method: "PATCH" });
}

export function markAllNotificationsRead(idToken: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/notifications/read-all", { idToken, method: "PATCH" });
}

export interface ReferralAnalytics {
  activeReferrals: number;
  conversions: number;
  trend: { month: string; referrals: number; conversions: number }[];
  topReferrers: { name: string; referrals: number; revenue: string }[];
  revenueBySource: { name: string; value: number }[];
}

export function getSalonReferralAnalytics(idToken: string): Promise<ReferralAnalytics> {
  return apiFetch<ReferralAnalytics>("/salon/referral-analytics", { idToken });
}

export interface SalonDashboardStats {
  totalClients: number;
  activeReferrals: number;
  rewardsIssued: number;
  monthlyRevenue: number;
  revenueGrowth: number | null;
  pendingAppointments: number;
}

export function getSalonDashboardStats(idToken: string): Promise<SalonDashboardStats> {
  return apiFetch<SalonDashboardStats>("/salon/dashboard-stats", { idToken });
}

export function getMyFavorites(idToken: string): Promise<string[]> {
  return apiFetch<string[]>("/me/favorites", { idToken });
}

export function addFavorite(idToken: string, salonId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/favorites/${salonId}`, { idToken, method: "POST" });
}

export function removeFavorite(idToken: string, salonId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/favorites/${salonId}`, { idToken, method: "DELETE" });
}

export type AppointmentStatus = "pending" | "confirmed" | "declined" | "cancelled";
export type PaymentMethod = "pay_now" | "pay_later";
export type AppointmentPaymentStatus = "unpaid" | "paid" | "refunded";

export interface MyAppointment {
  id: string;
  salonId: string;
  salonName: string;
  serviceId: string;
  serviceName: string;
  price: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: AppointmentPaymentStatus;
}

export interface SalonAppointment {
  id: string;
  clientName: string;
  clientEmail: string;
  serviceId: string;
  serviceName: string;
  price: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: AppointmentPaymentStatus;
}

export interface CreateAppointmentInput {
  salonId: string;
  serviceId: string;
  date: string;
  time: string;
  paymentMethod: PaymentMethod;
  paymentIntentId?: string;
}

export function createAppointment(
  idToken: string,
  input: CreateAppointmentInput
): Promise<{ id: string; status: AppointmentStatus; paymentStatus: AppointmentPaymentStatus; date: string; time: string }> {
  return apiFetch("/appointments", { idToken, method: "POST", body: input });
}

export function getMyAppointments(idToken: string): Promise<MyAppointment[]> {
  return apiFetch<MyAppointment[]>("/me/appointments", { idToken });
}

export function getSalonAppointments(idToken: string): Promise<SalonAppointment[]> {
  return apiFetch<SalonAppointment[]>("/salon/appointments", { idToken });
}

export function updateSalonAppointmentStatus(
  idToken: string,
  appointmentId: string,
  status: "confirmed" | "declined" | "cancelled"
): Promise<{ id: string; status: AppointmentStatus }> {
  return apiFetch(`/salon/appointments/${appointmentId}`, { idToken, method: "PATCH", body: { status } });
}

export function cancelMyAppointment(idToken: string, appointmentId: string): Promise<{ id: string; status: AppointmentStatus }> {
  return apiFetch(`/appointments/${appointmentId}/cancel`, { idToken, method: "PATCH" });
}

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
}

export function createPaymentIntent(idToken: string, salonId: string, serviceId: string): Promise<PaymentIntentResult> {
  return apiFetch<PaymentIntentResult>("/payments/create-intent", {
    idToken,
    method: "POST",
    body: { salonId, serviceId },
  });
}
