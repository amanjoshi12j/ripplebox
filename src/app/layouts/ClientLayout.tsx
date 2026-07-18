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

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 px-6 py-3 shadow-lg">
        <div className="flex justify-around items-center">
          {navItems.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end}>
              {({ isActive }) => (
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl ${
                    isActive ? "text-[#c9a3e8] dark:text-purple-400" : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="client-nav-pill"
                      className="absolute inset-0 -z-10 rounded-xl bg-[#e6d7f5]/25 dark:bg-purple-400/10"
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