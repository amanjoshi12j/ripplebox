import { Outlet, NavLink } from "react-router";
import { LayoutDashboard, TrendingUp, Gift, Users, Megaphone } from "lucide-react";

export function SalonOwnerLayout() {
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 px-4 py-3 shadow-lg">
        <div className="flex justify-around items-center">
          <NavLink
            to="/salon"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-[#d4af37] dark:text-amber-400" : "text-gray-400 dark:text-gray-500"
              }`
            }
          >
            <LayoutDashboard size={22} />
            <span className="text-[10px]">Dashboard</span>
          </NavLink>

          <NavLink
            to="/salon/analytics"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-[#d4af37] dark:text-amber-400" : "text-gray-400 dark:text-gray-500"
              }`
            }
          >
            <TrendingUp size={22} />
            <span className="text-[10px]">Analytics</span>
          </NavLink>

          <NavLink
            to="/salon/rewards"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-[#d4af37] dark:text-amber-400" : "text-gray-400 dark:text-gray-500"
              }`
            }
          >
            <Gift size={22} />
            <span className="text-[10px]">Rewards</span>
          </NavLink>

          <NavLink
            to="/salon/clients"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-[#d4af37] dark:text-amber-400" : "text-gray-400 dark:text-gray-500"
              }`
            }
          >
            <Users size={22} />
            <span className="text-[10px]">Clients</span>
          </NavLink>

          <NavLink
            to="/salon/campaigns"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-[#d4af37] dark:text-amber-400" : "text-gray-400 dark:text-gray-500"
              }`
            }
          >
            <Megaphone size={22} />
            <span className="text-[10px]">Campaigns</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
