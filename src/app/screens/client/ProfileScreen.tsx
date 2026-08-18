import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Settings,
  LogOut,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { useAuth } from "../../context/AuthContext";
import { getMe, getMyReferrals, getMyAppointments, type MeResponse } from "../../lib/apiClient";

export function ProfileScreen() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [referralsCompleted, setReferralsCompleted] = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!auth.idToken) return;
    const idToken = auth.idToken;
    Promise.all([getMe(idToken), getMyReferrals(idToken), getMyAppointments(idToken)])
      .then(([me, referrals, appointments]) => {
        setProfile(me);
        setReferralsCompleted(referrals.totalCompleted);
        setAppointmentCount(appointments.length);
      })
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false));
  }, [auth.idToken]);

  const lifetimePoints = profile?.salonPoints.reduce((sum, p) => sum + p.points, 0) ?? 0;

  const menuItems = [
    {
      icon: User,
      label: "Personal Information",
      action: () => navigate("/client/personal-info"),
    },
    {
      icon: Calendar,
      label: "My Appointments",
      action: () => navigate("/client/appointments"),
    },
    {
      icon: Settings,
      label: "Settings",
      action: () => navigate("/client/settings"),
    },
  ];

  const handleLogout = () => {
    auth.logout();
    navigate("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <Loader2 size={32} className="animate-spin text-[#e6d7f5] dark:text-purple-400" />
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 px-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Couldn't load your profile. Please check your connection and try again.
        </p>
        <button
          onClick={handleLogout}
          className="text-sm text-[#e6d7f5] dark:text-purple-400 hover:underline"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <h1 className="text-2xl mb-2 text-[#2d2d2d] dark:text-gray-100">Profile</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Manage your account and preferences</p>
      </div>

      <div className="px-6 -mt-8">
        {/* Profile card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4 mb-4">
            <ImageWithFallback
              src={profile.avatar ?? ""}
              alt={profile.name}
              className="w-20 h-20 rounded-full object-cover"
            />

            <div className="flex-1">
              <h2 className="text-xl mb-1 text-[#2d2d2d] dark:text-gray-100">{profile.name}</h2>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
              <Mail size={18} className="text-[#e6d7f5] dark:text-purple-400" />
              <span className="text-sm">{profile.email}</span>
            </div>
            {profile.phone && (
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                <Phone size={18} className="text-[#e6d7f5] dark:text-purple-400" />
                <span className="text-sm">{profile.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
              <Calendar size={18} className="text-[#e6d7f5] dark:text-purple-400" />
              <span className="text-sm">
                Member since {new Date(profile.memberSince).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl p-4 text-center border border-transparent dark:border-gray-700">
            <h3 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{lifetimePoints}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Lifetime Points</p>
          </div>
          <div className="bg-gradient-to-br from-[#f5f0fc] to-[#f5e6c3]/30 dark:from-indigo-900/30 dark:to-amber-900/30 rounded-2xl p-4 text-center border border-transparent dark:border-gray-700">
            <h3 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{referralsCompleted}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Referrals</p>
          </div>
          <div className="bg-gradient-to-br from-[#f5e6c3]/30 to-[#fef3f7] dark:from-amber-900/30 dark:to-pink-900/30 rounded-2xl p-4 text-center border border-transparent dark:border-gray-700">
            <h3 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{appointmentCount}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Appointments</p>
          </div>
        </div>

        {/* Menu items */}
        <div className="space-y-2 mb-6">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={item.action}
                className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center">
                    <Icon size={20} className="text-[#2d2d2d] dark:text-white" />
                  </div>
                  <span className="text-sm text-[#2d2d2d] dark:text-gray-100">{item.label}</span>
                </div>
                <ChevronRight size={20} className="text-gray-400 dark:text-gray-500" />
              </button>
            );
          })}
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-transparent dark:border-gray-700"
        >
          <LogOut size={20} />
          <span className="text-sm">Log Out</span>
        </button>

        {/* App version */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">Ripplebox v1.0.0</p>
      </div>
    </div>
  );
}
