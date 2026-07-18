import { useNavigate } from "react-router";
import { ArrowLeft, Moon, Sun, Bell, Globe, Palette, LogOut, Store, Scissors, CalendarCheck, ChevronRight } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { Switch } from "../../components/ui/switch";
import { Button } from "../../components/ui/button";
import { TwoFactorAuthCard } from "../../components/TwoFactorAuthCard";

export function SalonSettings() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    auth.logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/30 dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-[#2d2d2d] dark:text-gray-100" />
          </button>
          <h1 className="text-2xl text-[#2d2d2d] dark:text-gray-100">Settings</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm pl-14">
          Manage your salon preferences
        </p>
      </div>

      <div className="px-6 mt-6">
        {/* Business Information */}
        <div className="mb-6">
          <h2 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-2">
            Business Profile
          </h2>
          <button
            onClick={() => navigate("/salon/business-info")}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d4af37] to-[#f5e6c3] dark:from-amber-500 dark:to-yellow-500 flex items-center justify-center">
                <Store size={20} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm text-[#2d2d2d] dark:text-gray-100">Business Information</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Update salon details
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-400 dark:text-gray-500" />
          </button>
          <button
            onClick={() => navigate("/salon/services")}
            className="w-full flex items-center justify-between p-4 mt-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center">
                <Scissors size={20} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm text-[#2d2d2d] dark:text-gray-100">Services</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Manage services and pricing
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-400 dark:text-gray-500" />
          </button>
          <button
            onClick={() => navigate("/salon/appointments")}
            className="w-full flex items-center justify-between p-4 mt-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f5d7e3] to-[#fef3f7] dark:from-pink-500 dark:to-purple-500 flex items-center justify-center">
                <CalendarCheck size={20} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm text-[#2d2d2d] dark:text-gray-100">Appointments</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Confirm and manage bookings
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-400 dark:text-gray-500" />
          </button>
        </div>

        {/* Appearance Section */}
        <div className="mb-6">
          <h2 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-2">
            Appearance
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d4af37] to-[#f5e6c3] dark:from-amber-500 dark:to-yellow-500 flex items-center justify-center">
                  {theme === "dark" ? (
                    <Moon size={20} className="text-white" />
                  ) : (
                    <Sun size={20} className="text-white" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-[#2d2d2d] dark:text-gray-100">Dark Mode</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {theme === "dark" ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="mb-6">
          <h2 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-2">
            Business Notifications
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f5d7e3] to-[#fef3f7] dark:from-pink-500 dark:to-purple-500 flex items-center justify-center">
                  <Bell size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm text-[#2d2d2d] dark:text-gray-100">New Bookings</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Get notified of new appointments
                  </p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5f0fc] dark:from-purple-500 dark:to-indigo-500 flex items-center justify-center">
                  <Palette size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm text-[#2d2d2d] dark:text-gray-100">Referral Activity</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Track referral updates
                  </p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Privacy & Security Section */}
        <div className="mb-6">
          <h2 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-2">
            Privacy & Security
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            <TwoFactorAuthCard iconGradientClassName="from-[#d4af37] to-[#f5e6c3] dark:from-amber-600 dark:to-yellow-600" />
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/30 dark:from-yellow-500 dark:to-amber-500 flex items-center justify-center">
                  <Globe size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm text-[#2d2d2d] dark:text-gray-100">Analytics Data</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Share anonymized insights
                  </p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Logout Section */}
        <Button
          onClick={handleLogout}
          className="w-full bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-2xl h-14 flex items-center justify-center gap-2"
        >
          <LogOut size={20} />
          <span>Log Out</span>
        </Button>

        {/* Info Section */}
        <div className="bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/30 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 mt-6">
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            Ripplebox Business v1.0.0
          </p>
          <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
            © 2026 All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
