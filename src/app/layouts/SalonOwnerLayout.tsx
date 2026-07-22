import { Outlet, NavLink, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { LayoutDashboard, TrendingUp, Gift, Users, Megaphone, type LucideIcon } from "lucide-react";

const navItems: { to: string; end?: boolean; icon: LucideIcon; label: string }[] = [
  { to: "/salon", end: true, icon: LayoutDashboard, label: "Dashboard" },
  { to: "/salon/analytics", icon: TrendingUp, label: "Analytics" },
  { to: "/salon/rewards", icon: Gift, label: "Rewards" },
  { to: "/salon/clients", icon: Users, label: "Clients" },
  { to: "/salon/campaigns", icon: Megaphone, label: "Campaigns" },
];

export function SalonOwnerLayout() {
  const location = useLocation();

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation - floating glass pill, inset from the edges */}
      <nav className="fixed bottom-3 left-3 right-3 max-w-md mx-auto bg-white/90 dark:bg-gray-800/80 glass-surface border border-gray-100 dark:border-gray-700/60 px-3 py-2.5 rounded-3xl shadow-xl dark:shadow-black/40">
        <div className="flex justify-around items-center">
          {navItems.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end}>
              {({ isActive }) => (
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  className={`relative flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-2xl ${
                    isActive ? "text-[#d4af37] dark:text-amber-400" : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="salon-nav-pill"
                      className="absolute inset-0 -z-10 rounded-2xl bg-[#d4af37]/15 dark:bg-amber-400/15 dark:shadow-[0_0_16px_rgba(251,191,36,0.35)]"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Icon size={22} />
                  <span className="text-[10px]">{label}</span>
                </motion.div>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
