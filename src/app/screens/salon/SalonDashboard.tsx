import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import {
  Users,
  TrendingUp,
  Gift,
  DollarSign,
  ArrowUp,
  ArrowDown,
  Calendar,
  CalendarCheck,
  Scissors,
  Package,
  Settings,
  Loader2,
} from "lucide-react";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";
import {
  getSalonMe,
  getSalonDashboardStats,
  getNotifications,
  type SalonMeResponse,
  type SalonDashboardStats,
  type NotificationEntry,
} from "../../lib/apiClient";

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function SalonDashboard() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [salon, setSalon] = useState<SalonMeResponse | null>(null);
  const [stats, setStats] = useState<SalonDashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<NotificationEntry[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!auth.idToken) return;
    Promise.all([getSalonMe(auth.idToken), getSalonDashboardStats(auth.idToken), getNotifications(auth.idToken)])
      .then(([salonData, statsData, notifications]) => {
        setSalon(salonData);
        setStats(statsData);
        setRecentActivity(notifications.slice(0, 3));
      })
      .catch(() => setLoadError(true));
  }, [auth.idToken]);

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 px-8">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Couldn't load your salon right now. Please try again later.
        </p>
      </div>
    );
  }

  if (!salon || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <Loader2 size={32} className="animate-spin text-[#d4af37] dark:text-amber-400" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Clients",
      value: stats.totalClients.toLocaleString(),
      icon: Users,
      color: "from-[#e6d7f5] to-[#f5f0fc]",
      iconBg: "bg-[#e6d7f5]",
    },
    {
      label: "Active Referrals",
      value: stats.activeReferrals,
      icon: TrendingUp,
      color: "from-[#f5d7e3] to-[#fef3f7]",
      iconBg: "bg-[#f5d7e3]",
    },
    {
      label: "Rewards Issued",
      value: stats.rewardsIssued,
      icon: Gift,
      color: "from-[#f5e6c3] to-[#d4af37]/20",
      iconBg: "bg-[#d4af37]",
    },
    {
      label: "Monthly Revenue",
      value: `$${stats.monthlyRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "from-[#f5f0fc] to-[#f5e6c3]/30",
      iconBg: "bg-[#d4af37]",
      // Real month-over-month comparison - null (hidden) when there's no
      // prior month's revenue to meaningfully compare against.
      change: stats.revenueGrowth !== null ? `${stats.revenueGrowth > 0 ? "+" : ""}${stats.revenueGrowth}%` : null,
      changePositive: (stats.revenueGrowth ?? 0) >= 0,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/30 dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-amber-500/0 dark:bg-amber-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-yellow-500/0 dark:bg-yellow-500/10 blur-3xl" />
        <div className="relative flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <ImageWithFallback
              src={salon.image ?? ""}
              alt={salon.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-md dark:shadow-[0_0_16px_rgba(251,191,36,0.25)]"
            />
            <div>
              <h1 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{salon.name}</h1>
              <Badge className="bg-white/90 dark:bg-gray-700 text-[#d4af37] dark:text-amber-400 text-xs">Salon Owner</Badge>
            </div>
          </div>
          <Button
            onClick={() => navigate("/salon/settings")}
            variant="ghost"
            size="icon"
            className="text-[#2d2d2d] dark:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full"
            title="Settings"
          >
            <Settings size={20} />
          </Button>
        </div>
      </div>

      <div className="px-6 mt-6">
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className={`bg-gradient-to-br ${stat.color} dark:from-gray-800 dark:to-gray-700 rounded-2xl p-4 shadow-sm border border-transparent dark:border-gray-600`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-10 h-10 rounded-full ${stat.iconBg} dark:bg-amber-500 flex items-center justify-center`}
                  >
                    <Icon size={20} className="text-white" />
                  </div>
                  {stat.change && (
                    <div
                      className={`flex items-center gap-1 text-xs ${
                        stat.changePositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {stat.changePositive ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )}
                      <span>{stat.change}</span>
                    </div>
                  )}
                </div>
                <h3 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{stat.value}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Pending appointments - surfaced up top since these are time-sensitive
            and were previously easy to miss buried in Settings */}
        {stats.pendingAppointments > 0 && (
          <button
            onClick={() => navigate("/salon/appointments")}
            className="w-full flex items-center justify-between bg-gradient-to-r from-[#f5e6c3] to-[#d4af37]/30 dark:from-amber-900/30 dark:to-yellow-900/20 rounded-2xl p-4 mb-6 border border-[#d4af37]/30 dark:border-amber-700 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d4af37] to-[#f5e6c3] dark:from-amber-500 dark:to-yellow-500 flex items-center justify-center flex-shrink-0">
                <CalendarCheck size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-[#2d2d2d] dark:text-gray-100">
                  {stats.pendingAppointments} appointment{stats.pendingAppointments === 1 ? "" : "s"} awaiting your response
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Tap to confirm or decline</p>
              </div>
            </div>
          </button>
        )}

        {/* Quick actions */}
        <div className="mb-6">
          <h3 className="text-lg mb-4 text-[#2d2d2d] dark:text-gray-100">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => navigate("/salon/appointments")}
              className="h-auto flex-col gap-2 bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/30 dark:from-amber-500 dark:to-yellow-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-2xl p-4"
            >
              <CalendarCheck size={24} />
              <span className="text-sm">Appointments</span>
            </Button>
            <Button
              onClick={() => navigate("/salon/services")}
              className="h-auto flex-col gap-2 bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-2xl p-4"
            >
              <Scissors size={24} />
              <span className="text-sm">Services</span>
            </Button>
            <Button
              onClick={() => navigate("/salon/products")}
              className="h-auto flex-col gap-2 bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-pink-500 dark:to-purple-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-2xl p-4"
            >
              <Package size={24} />
              <span className="text-sm">Products</span>
            </Button>
            <Button
              onClick={() => navigate("/salon/campaigns")}
              className="h-auto flex-col gap-2 bg-gradient-to-br from-[#e6d7f5] to-[#f5f0fc] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-2xl p-4"
            >
              <Calendar size={24} />
              <span className="text-sm">Create Campaign</span>
            </Button>
            <Button
              onClick={() => navigate("/salon/analytics")}
              className="h-auto flex-col gap-2 bg-gradient-to-br from-[#f5d7e3] to-[#fef3f7] dark:from-pink-500 dark:to-purple-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-2xl p-4"
            >
              <TrendingUp size={24} />
              <span className="text-sm">View Analytics</span>
            </Button>
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg text-[#2d2d2d] dark:text-gray-100">Recent Activity</h3>
          </div>

          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
              Nothing yet - activity shows up here as clients earn and redeem.
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm text-[#2d2d2d] dark:text-gray-100">{activity.title}</h4>
                    <Badge variant="secondary" className="bg-[#e6d7f5]/20 dark:bg-purple-900/30 text-[#2d2d2d] dark:text-gray-100">
                      {timeAgo(activity.createdAt)}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{activity.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
