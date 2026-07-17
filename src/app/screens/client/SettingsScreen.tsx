import { useNavigate } from "react-router";
import { ArrowLeft, Moon, Sun, Bell, Lock, Globe, Palette } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { Switch } from "../../components/ui/switch";

export function SettingsScreen() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
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
          Customize your app experience
        </p>
      </div>

      <div className="px-6 mt-6">
        {/* Appearance Section */}
        <div className="mb-6">
          <h2 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-2">
            Appearance
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center">
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
            Notifications
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f5d7e3] to-[#fef3f7] dark:from-pink-500 dark:to-purple-500 flex items-center justify-center">
                  <Bell size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm text-[#2d2d2d] dark:text-gray-100">Push Notifications</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Receive updates and offers
                  </p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/30 dark:from-amber-500 dark:to-yellow-500 flex items-center justify-center">
                  <Palette size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm text-[#2d2d2d] dark:text-gray-100">Rewards Updates</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notifications about points
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
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5f0fc] dark:from-purple-600 dark:to-indigo-600 flex items-center justify-center">
                  <Lock size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm text-[#2d2d2d] dark:text-gray-100">Two-Factor Auth</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Extra security layer
                  </p>
                </div>
              </div>
              <Switch />
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f5f0fc] to-[#f5e6c3]/30 dark:from-indigo-500 dark:to-blue-500 flex items-center justify-center">
                  <Globe size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm text-[#2d2d2d] dark:text-gray-100">Share Data</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Help improve the app
                  </p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-800 dark:to-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            Ripplebox v1.0.0
          </p>
          <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
            © 2026 All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
