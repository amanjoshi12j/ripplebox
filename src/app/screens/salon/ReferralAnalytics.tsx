import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, Users, DollarSign, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getSalonReferralAnalytics, type ReferralAnalytics as ReferralAnalyticsData } from "../../lib/apiClient";

const SOURCE_COLORS = ["#e6d7f5", "#d4af37"];

export function ReferralAnalytics() {
  const auth = useAuth();
  const [data, setData] = useState<ReferralAnalyticsData | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!auth.idToken) return;
    getSalonReferralAnalytics(auth.idToken)
      .then(setData)
      .catch(() => setLoadError(true));
  }, [auth.idToken]);

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 px-8">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Couldn't load referral analytics right now. Please try again later.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800">
        <Loader2 size={32} className="animate-spin text-[#d4af37] dark:text-amber-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/30 dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <h1 className="text-2xl mb-2 text-[#2d2d2d] dark:text-gray-100">Referral Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Track your referral program performance</p>
      </div>

      <div className="px-6 mt-6">
        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gradient-to-br from-[#e6d7f5] to-[#f5f0fc] dark:from-gray-800 dark:to-gray-700 rounded-2xl p-4">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center mb-3">
              <TrendingUp size={20} className="text-[#e6d7f5] dark:text-amber-400" />
            </div>
            <h3 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{data.activeReferrals}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">Active Referrals</p>
          </div>

          <div className="bg-gradient-to-br from-[#f5d7e3] to-[#fef3f7] dark:from-gray-800 dark:to-gray-700 rounded-2xl p-4">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center mb-3">
              <Users size={20} className="text-[#f5d7e3] dark:text-amber-400" />
            </div>
            <h3 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{data.conversions}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">Conversions</p>
          </div>
        </div>

        {/* Referral trend chart */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-5 mb-6">
          <h3 className="text-base mb-4 text-[#2d2d2d] dark:text-gray-100">Referral Trend (Last 7 Months)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#888" />
              <YAxis tick={{ fontSize: 12 }} stroke="#888" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="referrals"
                stroke="#e6d7f5"
                strokeWidth={3}
                dot={{ fill: "#e6d7f5", r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="conversions"
                stroke="#f5d7e3"
                strokeWidth={3}
                dot={{ fill: "#f5d7e3", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by source - only 'referral' vs 'direct', since that's the
            only channel a visit can actually be attributed to (no campaign
            redemption tracking exists to support a 'marketing' bucket) */}
        {(data.revenueBySource[0]?.value ?? 0) + (data.revenueBySource[1]?.value ?? 0) > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-5 mb-6">
            <h3 className="text-base mb-4 text-[#2d2d2d] dark:text-gray-100">Revenue by Source</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.revenueBySource}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.revenueBySource.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top referrers */}
        <div>
          <h3 className="text-base mb-4 text-[#2d2d2d] dark:text-gray-100">Top Referrers</h3>
          {data.topReferrers.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
              No completed referrals yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.topReferrers.map((referrer, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-amber-400 dark:to-amber-500 flex items-center justify-center text-white text-sm">
                        #{index + 1}
                      </div>
                      <div>
                        <h4 className="text-sm text-[#2d2d2d] dark:text-gray-100">{referrer.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {referrer.referrals} referral{referrer.referrals !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[#d4af37] dark:text-amber-400">
                        <DollarSign size={14} />
                        <span className="text-sm">{referrer.revenue}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
                    </div>
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
