import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import {
  Store,
  Users,
  UserCog,
  CalendarCheck,
  DollarSign,
  Gift,
  Award,
  Megaphone,
  LogOut,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getAdminStats, type AdminStats } from "../../lib/apiClient";

export function AdminDashboard() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!auth.idToken) return;
    getAdminStats(auth.idToken)
      .then(setStats)
      .catch(() => setLoadError(true));
  }, [auth.idToken]);

  const handleLogout = () => {
    auth.logout();
    navigate("/admin/login");
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 px-8">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Couldn't load platform stats right now. Please try again later.
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <Loader2 size={32} className="animate-spin text-[#6b8cae] dark:text-cyan-400" />
      </div>
    );
  }

  const statCards = [
    { label: "Total Salons", value: stats.totalSalons.toLocaleString(), icon: Store, color: "from-[#dce8f5] to-[#eef3f7]", iconBg: "bg-[#6b8cae]" },
    { label: "Clients", value: stats.totalClients.toLocaleString(), icon: Users, color: "from-[#e6d7f5] to-[#f5f0fc]", iconBg: "bg-[#9b7ec9]" },
    { label: "Salon Owners", value: stats.totalSalonOwners.toLocaleString(), icon: UserCog, color: "from-[#f5e6c3] to-[#fdf6e3]", iconBg: "bg-[#d4af37]" },
    { label: "Appointments", value: stats.totalAppointments.toLocaleString(), icon: CalendarCheck, color: "from-[#f5d7e3] to-[#fef3f7]", iconBg: "bg-[#c9789e]" },
    { label: "Platform Revenue", value: `$${Number(stats.totalRevenue).toLocaleString()}`, icon: DollarSign, color: "from-[#d9f0e3] to-[#eefaf2]", iconBg: "bg-[#4a9d6f]" },
    { label: "Points Issued", value: stats.totalPointsIssued.toLocaleString(), icon: Award, color: "from-[#fde8d4] to-[#fef6ec]", iconBg: "bg-[#d68a3a]" },
    { label: "Redemptions", value: stats.totalRedemptions.toLocaleString(), icon: Gift, color: "from-[#dce8f5] to-[#eef3f7]", iconBg: "bg-[#6b8cae]" },
    { label: "Active Campaigns", value: stats.activeCampaigns.toLocaleString(), icon: Megaphone, color: "from-[#e6d7f5] to-[#f5f0fc]", iconBg: "bg-[#9b7ec9]" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#dce8f5] to-[#eef3f7] dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-cyan-500/0 dark:bg-cyan-500/20 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6b8cae] to-[#a9c4de] dark:from-cyan-500 dark:to-blue-500 flex items-center justify-center shadow-md">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl text-[#2d2d2d] dark:text-gray-100">Platform Overview</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Across every salon &amp; client</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-2 rounded-full text-[#2d2d2d] dark:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="px-6 mt-6 grid grid-cols-2 gap-3">
        {statCards.map(({ label, value, icon: Icon, color, iconBg }) => (
          <div
            key={label}
            className={`bg-gradient-to-br ${color} dark:from-gray-800 dark:to-gray-800 rounded-2xl p-4 border border-transparent dark:border-gray-700`}
          >
            <div className={`w-9 h-9 rounded-full ${iconBg} dark:bg-gray-700 flex items-center justify-center mb-3`}>
              <Icon size={18} className="text-white" />
            </div>
            <h3 className="text-xl mb-0.5 text-[#2d2d2d] dark:text-gray-100">{value}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="px-6 mt-6 space-y-3">
        <button
          onClick={() => navigate("/admin/salons")}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <Store size={20} className="text-[#6b8cae] dark:text-cyan-400" />
            <span className="text-sm text-[#2d2d2d] dark:text-gray-100">Manage salons</span>
          </div>
        </button>
        <button
          onClick={() => navigate("/admin/users")}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <Users size={20} className="text-[#6b8cae] dark:text-cyan-400" />
            <span className="text-sm text-[#2d2d2d] dark:text-gray-100">Search users</span>
          </div>
        </button>
      </div>
    </div>
  );
}
