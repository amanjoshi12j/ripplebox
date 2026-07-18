import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Share2, Gift, Calendar, Sparkles, Heart, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import { Badge } from "../../components/ui/badge";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { useAuth } from "../../context/AuthContext";
import {
  getSalons,
  getMe,
  getMyReferrals,
  getMyFavorites,
  type SalonSummary,
  type MeResponse,
} from "../../lib/apiClient";

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

export function ClientHome() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [salons, setSalons] = useState<SalonSummary[] | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [referralsCompleted, setReferralsCompleted] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!auth.idToken) return;
    Promise.all([getSalons(), getMe(auth.idToken), getMyReferrals(auth.idToken), getMyFavorites(auth.idToken)])
      .then(([salonList, meData, referrals, favoriteIds]) => {
        setSalons(salonList);
        setMe(meData);
        setReferralsCompleted(referrals.totalCompleted);
        setFavorites(favoriteIds);
      })
      .catch(() => setLoadError(true));
  }, [auth.idToken]);

  const featuredSalons = (salons ?? []).slice(0, 3);
  const getSalonName = (salonId: string) => salons?.find((s) => s.id === salonId)?.name ?? "Unknown Salon";
  const lifetimePoints = me?.salonPoints.reduce((sum, p) => sum + p.points, 0) ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <h1 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">
          Hi{me ? `, ${me.name.split(" ")[0]}` : ""} ✨
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Welcome back to your beauty hub</p>
      </div>

      <motion.div className="px-6 -mt-4" variants={staggerContainer} initial="hidden" animate="show">
        {/* Loyalty progress card */}
        <motion.div
          variants={staggerItem}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Your Loyalty Status</p>
              <h3 className="text-xl text-[#2d2d2d] dark:text-gray-100">Gold Member</h3>
            </div>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#d4af37] to-[#f5e6c3] dark:from-amber-500 dark:to-yellow-500 flex items-center justify-center">
              <Sparkles size={32} className="text-white" />
            </div>
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">Next tier: Platinum</span>
              <span className="text-[#2d2d2d] dark:text-gray-100">{lifetimePoints} / 500 lifetime pts</span>
            </div>
            <Progress value={(lifetimePoints / 500) * 100} className="h-3 bg-gray-100 dark:bg-gray-700" />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {Math.max(500 - lifetimePoints, 0)} lifetime points to unlock exclusive perks! Redeemable
            reward points are tracked separately per salon.
          </p>
        </motion.div>

        {/* Per-salon points breakdown - these balances are NOT interchangeable */}
        <motion.div
          variants={staggerItem}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 mb-6 border border-gray-100 dark:border-gray-700"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Your Points by Salon</p>
          {(me?.salonPoints ?? []).filter((s) => s.points > 0).length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No points yet - visit a salon to start earning!
            </p>
          ) : (
            <div className="space-y-2">
              {me!.salonPoints
                .filter((s) => s.points > 0)
                .map((s) => (
                  <div
                    key={s.salonId}
                    onClick={() => navigate(`/client/salons/${s.salonId}`)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  >
                    <span className="text-sm text-[#2d2d2d] dark:text-gray-100">{getSalonName(s.salonId)}</span>
                    <Badge
                      variant="secondary"
                      className="bg-[#f5d7e3]/30 dark:bg-pink-900/30 text-[#2d2d2d] dark:text-gray-100"
                    >
                      {s.points} pts
                    </Badge>
                  </div>
                ))}
            </div>
          )}
        </motion.div>

        {/* Quick actions */}
        <motion.div variants={staggerItem} className="grid grid-cols-3 gap-3 mb-6">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate("/client/referral")}
            className="bg-gradient-to-br from-[#e6d7f5] to-[#f5f0fc] dark:from-purple-500 dark:to-indigo-500 rounded-2xl p-4 text-center hover:shadow-md transition-shadow border border-transparent dark:border-gray-700"
          >
            <Share2 size={24} className="mx-auto mb-2 text-[#2d2d2d] dark:text-white" />
            <span className="text-xs text-[#2d2d2d] dark:text-white">Refer Friend</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate("/client/rewards")}
            className="bg-gradient-to-br from-[#f5d7e3] to-[#fef3f7] dark:from-pink-500 dark:to-purple-500 rounded-2xl p-4 text-center hover:shadow-md transition-shadow border border-transparent dark:border-gray-700"
          >
            <Gift size={24} className="mx-auto mb-2 text-[#2d2d2d] dark:text-white" />
            <span className="text-xs text-[#2d2d2d] dark:text-white">My Rewards</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate("/client/appointments")}
            className="bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/20 dark:from-amber-500 dark:to-yellow-500 rounded-2xl p-4 text-center hover:shadow-md transition-shadow border border-transparent dark:border-gray-700"
          >
            <Calendar size={24} className="mx-auto mb-2 text-[#2d2d2d] dark:text-white" />
            <span className="text-xs text-[#2d2d2d] dark:text-white">Appointments</span>
          </motion.button>
        </motion.div>

        {/* Referral stats card */}
        <motion.div
          variants={staggerItem}
          className="bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-600 dark:to-pink-600 rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#2d2d2d]/70 dark:text-white/70 mb-1">Friends Referred</p>
              <h3 className="text-3xl text-[#2d2d2d] dark:text-white mb-1">{referralsCompleted}</h3>
            </div>
            <Button
              onClick={() => navigate("/client/referral")}
              className="bg-white dark:bg-gray-800 text-[#2d2d2d] dark:text-white hover:bg-white/90 dark:hover:bg-gray-700 rounded-xl"
            >
              Share Code
            </Button>
          </div>
        </motion.div>

        {/* Featured salons */}
        <motion.div variants={staggerItem} className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg text-[#2d2d2d] dark:text-gray-100">Featured Salons</h3>
            <button
              onClick={() => navigate("/client/salons")}
              className="text-sm text-[#e6d7f5] dark:text-purple-400 hover:underline"
            >
              See all
            </button>
          </div>

          {loadError ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
              Couldn't load salons right now.
            </p>
          ) : salons === null ? (
            <div className="flex justify-center py-6">
              <Loader2 size={24} className="animate-spin text-[#e6d7f5] dark:text-purple-400" />
            </div>
          ) : (
            <div className="space-y-3">
              {featuredSalons.map((salon) => (
                <motion.div
                  key={salon.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/client/salons/${salon.id}`)}
                  className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-md border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <ImageWithFallback
                    src={salon.image ?? ""}
                    alt={salon.name}
                    className="w-20 h-20 rounded-xl object-cover"
                  />
                  <div className="flex-1">
                    <h4 className="text-sm mb-1 text-[#2d2d2d] dark:text-gray-100">{salon.name}</h4>
                    <div className="inline-block bg-[#f5d7e3] dark:bg-pink-900/30 px-3 py-1 rounded-full">
                      <span className="text-xs text-[#2d2d2d] dark:text-gray-100">
                        {parseFloat(salon.rewardMultiplier)}x Rewards
                      </span>
                    </div>
                  </div>
                  <Heart
                    size={20}
                    className={
                      favorites.includes(salon.id)
                        ? "fill-[#f5d7e3] dark:fill-pink-400 text-[#f5d7e3] dark:text-pink-400"
                        : "text-gray-300 dark:text-gray-600"
                    }
                  />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
