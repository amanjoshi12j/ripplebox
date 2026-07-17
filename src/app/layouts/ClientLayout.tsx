import { Outlet, NavLink } from "react-router";
import { Home, Sparkles, Gift, Bell, User } from "lucide-react";
import { ChatBubble } from "../components/ChatBubble";

export function ClientLayout() {
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </div>

      {/* Floating chatbot, available on every client screen */}
      <ChatBubble />

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 px-6 py-3 shadow-lg">
        <div className="flex justify-around items-center">
          <NavLink
            to="/client"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-[#e6d7f5] dark:text-purple-400" : "text-gray-400 dark:text-gray-500"
              }`
            }
          >
            <Home size={24} />
            <span className="text-xs">Home</span>
          </NavLink>

          <NavLink
            to="/client/salons"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-[#e6d7f5] dark:text-purple-400" : "text-gray-400 dark:text-gray-500"
              }`
            }
          >
            <Sparkles size={24} />
            <span className="text-xs">Salons</span>
          </NavLink>

          <NavLink
            to="/client/rewards"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-[#e6d7f5] dark:text-purple-400" : "text-gray-400 dark:text-gray-500"
              }`
            }
          >
            <Gift size={24} />
            <span className="text-xs">Rewards</span>
          </NavLink>

          <NavLink
            to="/client/notifications"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-[#e6d7f5] dark:text-purple-400" : "text-gray-400 dark:text-gray-500"
              }`
            }
          >
            <Bell size={24} />
            <span className="text-xs">Notifications</span>
          </NavLink>

          <NavLink
            to="/client/profile"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-[#e6d7f5] dark:text-purple-400" : "text-gray-400 dark:text-gray-500"
              }`
            }
          >
            <User size={24} />
            <span className="text-xs">Profile</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}