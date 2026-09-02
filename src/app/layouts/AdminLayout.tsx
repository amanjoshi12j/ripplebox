import { Outlet, NavLink, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { LayoutDashboard, Store, Users, type LucideIcon } from "lucide-react";

const navItems: { to: string; end?: boolean; icon: LucideIcon; label: string }[] = [
  { to: "/admin", end: true, icon: LayoutDashboard, label: "Overview" },
  { to: "/admin/salons", icon: Store, label: "Salons" },
  { to: "/admin/users", icon: Users, label: "Users" },
];

export function AdminLayout() {
  const location = useLocation();

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto">
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

      {/* Bottom navigation - same floating glass pill as the other two
          personas, own accent (cool slate-blue) so it's visually distinct
          from client (lavender) and salon (gold) at a glance. */}
      <nav className="fixed bottom-3 left-3 right-3 max-w-md mx-auto bg-white/55 dark:bg-gray-800/45 glass-surface border border-white/60 dark:border-white/10 px-3 py-2.5 rounded-3xl shadow-[0_8px_32px_rgba(107,140,174,0.25),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)]">
        <div className="flex justify-around items-center">
          {navItems.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end}>
              {({ isActive }) => (
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  className={`relative flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-2xl ${
                    isActive ? "text-[#6b8cae] dark:text-cyan-400" : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="admin-nav-pill"
                      className="absolute inset-0 -z-10 rounded-2xl bg-[#6b8cae]/15 dark:bg-cyan-400/15 dark:shadow-[0_0_16px_rgba(34,211,238,0.35)]"
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
