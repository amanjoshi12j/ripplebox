import { useEffect, useState } from "react";
import { Gift, Crown, Zap, DollarSign, Calendar, Check, Lock, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import referralRewardsIcon from "../../../imports/Screenshot_2026-04-15_142834.png";
import { useAuth } from "../../context/AuthContext";
import {
  getMe,
  getSalons,
  getSalonRewards,
  redeemReward as redeemRewardRequest,
  type SalonSummary,
  type RewardSummary,
} from "../../lib/apiClient";

export function RewardsScreen() {
  const auth = useAuth();
  const [salons, setSalons] = useState<SalonSummary[]>([]);
  const [salonPoints, setSalonPoints] = useState<Record<string, number>>({});
  const [rewardsBySalon, setRewardsBySalon] = useState<Record<string, RewardSummary[]>>({});
  // Rewards redeemed this session - there's no GET /me/redemptions endpoint
  // yet, so the "Redeemed" tab can only reflect what happened since the
  // page loaded, not full history.
  const [redeemedThisSession, setRedeemedThisSession] = useState<RewardSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const loadData = async () => {
    if (!auth.idToken) return;
    const [me, salonList] = await Promise.all([getMe(auth.idToken), getSalons()]);

    const pointsMap: Record<string, number> = {};
    me.salonPoints.forEach((p) => (pointsMap[p.salonId] = p.points));

    const rewardLists = await Promise.all(salonList.map((s) => getSalonRewards(s.id)));
    const rewardsMap: Record<string, RewardSummary[]> = {};
    salonList.forEach((s, i) => (rewardsMap[s.id] = rewardLists[i]));

    setSalons(salonList);
    setSalonPoints(pointsMap);
    setRewardsBySalon(rewardsMap);
  };

  useEffect(() => {
    loadData()
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false));
  }, [auth.idToken]);

  const getSalonName = (salonId: string) => salons.find((s) => s.id === salonId)?.name ?? "Unknown Salon";
  const totalPoints = Object.values(salonPoints).reduce((sum, p) => sum + p, 0);

  const availableBySalon = salons
    .map((salon) => ({ salon, rewards: rewardsBySalon[salon.id] ?? [] }))
    .filter(({ rewards }) => rewards.length > 0);

  const getCategoryIcon = (category: string | null) => {
    switch (category) {
      case "discount":
        return <Zap size={20} className="text-[#e6d7f5]" />;
      case "freebie":
        return <Gift size={20} className="text-[#f5d7e3]" />;
      case "premium":
        return <Crown size={20} className="text-[#d4af37]" />;
      case "credit":
        return <DollarSign size={20} className="text-[#e6d7f5]" />;
      default:
        return <Gift size={20} />;
    }
  };

  const handleRedeem = async (reward: RewardSummary) => {
    if (!auth.idToken) return;
    setRedeemingId(reward.id);
    try {
      const result = await redeemRewardRequest(auth.idToken, reward.id);
      toast.success(`Redeemed ${result.rewardTitle} at ${getSalonName(result.salonId)}!`);
      setSalonPoints((prev) => ({ ...prev, [result.salonId]: result.pointsRemaining }));
      setRewardsBySalon((prev) => ({
        ...prev,
        [result.salonId]: (prev[result.salonId] ?? []).filter((r) => r.id !== reward.id),
      }));
      setRedeemedThisSession((prev) => [...prev, reward]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong redeeming this reward.");
    } finally {
      setRedeemingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800">
        <Loader2 size={32} className="animate-spin text-[#e6d7f5] dark:text-purple-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 px-8">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Couldn't load rewards right now. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-900 dark:to-gray-800 px-6 pt-12 pb-8 rounded-b-3xl">
        <div className="flex items-center gap-3 mb-2">
          <img src={referralRewardsIcon} alt="Earn & Redeem Rewards" className="w-10 h-10" />
          <h1 className="text-2xl text-[#2d2d2d] dark:text-gray-100">Your Rewards</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Points are earned per salon and can only be redeemed at that same salon
        </p>

        {/* Lifetime points summary (informational only - not a spendable pool) */}
        <div className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700 rounded-2xl shadow-lg p-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Lifetime Points (all salons)</p>
              <h2 className="text-3xl text-[#2d2d2d] dark:text-gray-100">{totalPoints}</h2>
              <p className="text-xs text-gray-400 mt-1">See breakdown by salon below</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] flex items-center justify-center">
              <Gift size={32} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 mt-6">
        <Tabs defaultValue="available" className="w-full">
          <TabsList className="w-full mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <TabsTrigger
              value="available"
              className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700 dark:text-gray-400 dark:data-[state=active]:text-gray-100"
            >
              Available
            </TabsTrigger>
            <TabsTrigger
              value="redeemed"
              className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700 dark:text-gray-400 dark:data-[state=active]:text-gray-100"
            >
              Redeemed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-6">
            {availableBySalon.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Gift size={40} className="text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400">No rewards available yet</p>
                <p className="text-sm text-gray-400 mt-2">Keep earning points to unlock rewards!</p>
              </div>
            ) : (
              availableBySalon.map(({ salon, rewards: salonRewards }) => {
                const points = salonPoints[salon.id] ?? 0;
                return (
                  <div key={salon.id}>
                    {/* Salon header with that salon's own balance */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base text-[#2d2d2d] dark:text-gray-100">{salon.name}</h3>
                      <Badge
                        variant="secondary"
                        className="bg-[#e6d7f5]/30 dark:bg-purple-900/30 text-[#2d2d2d] dark:text-gray-100"
                      >
                        {points} pts here
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      {salonRewards.map((reward) => {
                        const canRedeem = points >= reward.pointsCost;
                        const isRedeeming = redeemingId === reward.id;
                        return (
                          <div
                            key={reward.id}
                            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-700"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center flex-shrink-0">
                                {getCategoryIcon(reward.category)}
                              </div>

                              <div className="flex-1 min-w-0">
                                <h3 className="text-base mb-1 text-[#2d2d2d] dark:text-gray-100">{reward.title}</h3>
                                {reward.description && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{reward.description}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                  <Badge
                                    variant="secondary"
                                    className="bg-[#f5d7e3]/30 dark:bg-pink-900/30 text-[#2d2d2d] dark:text-gray-100 hover:bg-[#f5d7e3]/40 dark:hover:bg-pink-900/40"
                                  >
                                    {salon.name}
                                  </Badge>
                                  {reward.expiresAt && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                      <Calendar size={14} />
                                      <span>Expires {new Date(reward.expiresAt).toLocaleDateString()}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500 dark:text-gray-400">Points:</span>
                                    <span className="text-base text-[#2d2d2d] dark:text-gray-100">
                                      {reward.pointsCost}
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    disabled={!canRedeem || isRedeeming}
                                    onClick={() => handleRedeem(reward)}
                                    className="bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] text-[#2d2d2d] hover:opacity-90 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {isRedeeming ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : canRedeem ? (
                                      "Redeem"
                                    ) : (
                                      <>
                                        <Lock size={14} className="mr-1" />
                                        {reward.pointsCost - points} more
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="redeemed" className="space-y-6">
            {redeemedThisSession.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Check size={40} className="text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400">No redeemed rewards yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {redeemedThisSession.map((reward, index) => (
                  <div
                    key={`${reward.id}-${index}`}
                    className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 opacity-75"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <Check size={20} className="text-gray-500 dark:text-gray-400" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-base mb-1 text-[#2d2d2d] dark:text-gray-100">{reward.title}</h3>
                        {reward.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{reward.description}</p>
                        )}
                        <Badge variant="secondary" className="bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          Redeemed
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
