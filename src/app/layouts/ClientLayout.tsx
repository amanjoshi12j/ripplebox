import { Outlet, NavLink, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Home, Sparkles, Gift, Bell, User, type LucideIcon } from "lucide-react";
import { ChatBubble } from "../components/ChatBubble";

const navItems: { to: string; end?: boolean; icon: LucideIcon; label: string }[] = [
  { to: "/client", end: true, icon: Home, label: "Home" },
  { to: "/client/salons", icon: Sparkles, label: "Salons" },
  { to: "/client/rewards", icon: Gift, label: "Rewards" },
  { to: "/client/notifications", icon: Bell, label: "Notifications" },
  { to: "/client/profile", icon: User, label: "Profile" },
];

export function ClientLayout() {
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

      {/* Floating chatbot, available on every client screen */}
      <ChatBubble />

      {/* Bottom navigation - floating glass pill, inset from the edges */}
      <nav className="fixed bottom-3 left-3 right-3 max-w-md mx-auto bg-white/90 dark:bg-gray-800/80 glass-surface border border-gray-100 dark:border-gray-700/60 px-4 py-2.5 rounded-3xl shadow-xl dark:shadow-black/40">
        <div className="flex justify-around items-center">
          {navItems.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end}>
              {({ isActive }) => (
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl ${
                    isActive ? "text-[#c9a3e8] dark:text-purple-300" : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="client-nav-pill"
                      className="absolute inset-0 -z-10 rounded-2xl bg-[#e6d7f5]/25 dark:bg-purple-400/15 dark:shadow-[0_0_16px_rgba(192,132,252,0.35)]"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Icon size={24} />
                  <span className="text-xs">{label}</span>
                </motion.div>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}