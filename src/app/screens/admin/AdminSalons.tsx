import { useEffect, useState } from "react";
import { Search, Loader2, Ban, CheckCircle2 } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { useAuth } from "../../context/AuthContext";
import { getAdminSalons, setAdminSalonSuspended, type AdminSalonSummary } from "../../lib/apiClient";

export function AdminSalons() {
  const auth = useAuth();
  const [salons, setSalons] = useState<AdminSalonSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = (q?: string) => {
    if (!auth.idToken) return;
    return getAdminSalons(auth.idToken, q).then(setSalons);
  };

  // One debounced effect covers both the initial load (query starts empty)
  // and every subsequent search keystroke - a separate mount-only effect
  // would just double-fetch on load.
  useEffect(() => {
    const timer = setTimeout(() => {
      load(query || undefined)?.catch(() => setLoadError(true));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, auth.idToken]);

  const toggleSuspend = async (salon: AdminSalonSummary) => {
    if (!auth.idToken) return;
    setUpdatingId(salon.id);
    try {
      await setAdminSalonSuspended(auth.idToken, salon.id, !salon.isSuspended);
      setSalons((prev) =>
        prev ? prev.map((s) => (s.id === salon.id ? { ...s, isSuspended: !salon.isSuspended } : s)) : prev
      );
    } catch {
      // Non-fatal - the row just won't have updated; the button is safe to
      // press again since it always sends the intended target state.
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pb-6">
      <div className="bg-gradient-to-br from-[#dce8f5] to-[#eef3f7] dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">Salons</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Every salon on the platform</p>
      </div>

      <div className="px-6 -mt-3">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by salon name or owner email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11 h-12 rounded-xl bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 border-0 shadow-sm"
          />
        </div>
      </div>

      <div className="px-6 mt-4 space-y-3">
        {loadError ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">Couldn't load salons right now.</p>
        ) : salons === null ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[#6b8cae] dark:text-cyan-400" />
          </div>
        ) : salons.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">No salons match that search.</p>
        ) : (
          salons.map((salon) => (
            <div
              key={salon.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm text-[#2d2d2d] dark:text-gray-100">{salon.name}</h4>
                    {salon.isSuspended && (
                      <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs">
                        Suspended
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    Owner: {salon.ownerName} · {salon.ownerEmail}
                  </p>
                </div>
                <button
                  onClick={() => toggleSuspend(salon)}
                  disabled={updatingId === salon.id}
                  className={`flex-none flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60 ${
                    salon.isSuspended
                      ? "border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                      : "border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  }`}
                >
                  {updatingId === salon.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : salon.isSuspended ? (
                    <CheckCircle2 size={13} />
                  ) : (
                    <Ban size={13} />
                  )}
                  {salon.isSuspended ? "Reactivate" : "Suspend"}
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-sm text-[#2d2d2d] dark:text-gray-100">{salon.clientCount}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Clients</p>
                </div>
                <div>
                  <p className="text-sm text-[#2d2d2d] dark:text-gray-100">{salon.appointmentCount}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Bookings</p>
                </div>
                <div>
                  <p className="text-sm text-[#2d2d2d] dark:text-gray-100">{salon.rewardsIssued}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Redeemed</p>
                </div>
                <div>
                  <p className="text-sm text-[#2d2d2d] dark:text-gray-100">${Number(salon.totalRevenue).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Revenue</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
