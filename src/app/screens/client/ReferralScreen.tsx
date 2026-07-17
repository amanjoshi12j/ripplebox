import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Share2, Copy, Users, Award, Check, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import {
  getMe,
  getSalons,
  getMyReferrals,
  type MeResponse,
  type SalonSummary,
  type MyReferralsResponse,
} from "../../lib/apiClient";

export function ReferralScreen() {
  const auth = useAuth();
  const [copied, setCopied] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [salons, setSalons] = useState<SalonSummary[]>([]);
  const [referralsData, setReferralsData] = useState<MyReferralsResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedSalonId, setSelectedSalonId] = useState<string>("");

  useEffect(() => {
    if (!auth.idToken) return;
    Promise.all([getMe(auth.idToken), getSalons(), getMyReferrals(auth.idToken)])
      .then(([meData, salonList, referrals]) => {
        setMe(meData);
        setSalons(salonList);
        setReferralsData(referrals);
        if (salonList.length > 0) setSelectedSalonId(salonList[0].id);
      })
      .catch(() => setLoadError(true));
  }, [auth.idToken]);

  const getSalonName = (salonId: string) => salons.find((s) => s.id === salonId)?.name ?? "Unknown Salon";

  const referralUrl = me
    ? `${window.location.origin}/signup?ref=${me.referralCode}&salon=${selectedSalonId}`
    : "";

  const handleCopyCode = () => {
    if (!me?.referralCode) return;
    navigator.clipboard.writeText(me.referralCode);
    setCopied(true);
    toast.success("Referral code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!me) return;
    const shareData = {
      title: "Join Ripplebox",
      text: `Join me on Ripplebox and get exclusive rewards at ${getSalonName(
        selectedSalonId
      )}! Use my code: ${me.referralCode}`,
      url: referralUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        handleCopyCode();
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 px-8">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Couldn't load your referral info right now. Please try again later.
        </p>
      </div>
    );
  }

  if (!me || !referralsData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <Loader2 size={32} className="animate-spin text-[#e6d7f5] dark:text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <h1 className="text-2xl mb-2 text-[#2d2d2d] dark:text-gray-100">Share & Earn</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Invite friends and earn rewards together</p>
      </div>

      <div className="px-6 -mt-4">
        {/* Referral stats */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 border border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5f0fc] dark:from-purple-500 dark:to-indigo-500 flex items-center justify-center">
                <Users size={24} className="text-white" />
              </div>
              <h3 className="text-2xl text-[#2d2d2d] dark:text-gray-100 mb-1">{referralsData.totalCompleted}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Friends Referred</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-[#f5d7e3] to-[#fef3f7] dark:from-pink-500 dark:to-purple-500 flex items-center justify-center">
                <Award size={24} className="text-white" />
              </div>
              <h3 className="text-2xl text-[#2d2d2d] dark:text-gray-100 mb-1">
                {referralsData.totalPointsEarned}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Points Earned from Referrals</p>
            </div>
          </div>
        </div>

        {/* Salon picker - determines where the referral points get credited */}
        {salons.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 mb-6 border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Credit points from this invite to</p>
            <Select value={selectedSalonId} onValueChange={setSelectedSalonId}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Choose a salon" />
              </SelectTrigger>
              <SelectContent>
                {salons.map((salon) => (
                  <SelectItem key={salon.id} value={salon.id}>
                    {salon.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400 mt-2">
              Your friend's booking bonus and your referral reward will both apply to this salon only.
            </p>
          </div>
        )}

        {/* QR Code and Referral Code */}
        <div className="bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-600 dark:to-pink-600 rounded-2xl p-6 mb-6">
          <h3 className="text-lg mb-4 text-center text-[#2d2d2d] dark:text-white">Your Referral Code</h3>

          {/* QR Code */}
          <div className="bg-white rounded-2xl p-6 mb-4 flex justify-center">
            <QRCodeSVG value={referralUrl} size={180} level="H" includeMargin={true} fgColor="#3a3a3a" />
          </div>

          {/* Code */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4">
            <p className="text-center text-2xl tracking-wider text-[#2d2d2d] dark:text-gray-100">
              {me.referralCode}
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleCopyCode}
              variant="outline"
              className="bg-white dark:bg-gray-800 border-0 text-[#2d2d2d] dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl h-12"
            >
              {copied ? (
                <>
                  <Check size={18} className="mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={18} className="mr-2" />
                  Copy Code
                </>
              )}
            </Button>
            <Button
              onClick={handleShare}
              className="bg-[#2d2d2d] dark:bg-gray-700 text-white hover:bg-[#2d2d2d]/90 dark:hover:bg-gray-600 rounded-xl h-12"
            >
              <Share2 size={18} className="mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 mb-6 border border-transparent dark:border-gray-700">
          <h3 className="text-base mb-4 text-[#2d2d2d] dark:text-gray-100">How It Works</h3>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5f0fc] dark:from-purple-500 dark:to-indigo-500 flex items-center justify-center flex-shrink-0 text-white text-sm">
                1
              </div>
              <div>
                <h4 className="text-sm mb-1 text-[#2d2d2d] dark:text-gray-100">Share your code</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Send your referral code to friends</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5f0fc] dark:from-purple-500 dark:to-indigo-500 flex items-center justify-center flex-shrink-0 text-white text-sm">
                2
              </div>
              <div>
                <h4 className="text-sm mb-1 text-[#2d2d2d] dark:text-gray-100">They sign up</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Your friend joins using your code</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5f0fc] dark:from-purple-500 dark:to-indigo-500 flex items-center justify-center flex-shrink-0 text-white text-sm">
                3
              </div>
              <div>
                <h4 className="text-sm mb-1 text-[#2d2d2d] dark:text-gray-100">You both earn</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Get 50 points each at the salon you picked above when they visit
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Referral history */}
        <div>
          <h3 className="text-lg mb-4 text-[#2d2d2d] dark:text-gray-100">Recent Referrals</h3>
          {referralsData.referrals.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
              No referrals yet - share your code above to get started!
            </p>
          ) : (
            <div className="space-y-3">
              {referralsData.referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center text-white text-sm">
                      {referral.referredName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm text-[#2d2d2d] dark:text-gray-100">{referral.referredName}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(referral.createdAt).toLocaleDateString()} · {referral.salonName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {referral.status === "completed" ? (
                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <Check size={16} />
                        <span className="text-sm">+{referral.pointsAwarded} pts</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">Pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
