import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2, Calendar, Clock, Banknote, CreditCard, Award } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { getMyAppointments, cancelMyAppointment, type MyAppointment } from "../../lib/apiClient";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  confirmed: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  declined: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  cancelled: "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
};

export function MyAppointmentsScreen() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [appointments, setAppointments] = useState<MyAppointment[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    if (!auth.idToken) return;
    return getMyAppointments(auth.idToken).then(setAppointments);
  };

  useEffect(() => {
    load()?.catch(() => setLoadError(true));
  }, [auth.idToken]);

  const handleCancel = async (appointmentId: string) => {
    if (!auth.idToken) return;
    try {
      await cancelMyAppointment(auth.idToken, appointmentId);
      toast.success("Booking cancelled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel this booking.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pb-6">
      <div className="bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-[#2d2d2d] dark:text-gray-100" />
          </button>
          <h1 className="text-2xl text-[#2d2d2d] dark:text-gray-100">My Appointments</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm pl-14">Your bookings across all salons</p>
      </div>

      <div className="px-6 mt-6">
        {loadError ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">
            Couldn't load your appointments right now.
          </p>
        ) : appointments === null ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[#e6d7f5] dark:text-purple-400" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No appointments yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Book a service from a salon's profile to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((a) => (
              <div
                key={a.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-sm text-[#2d2d2d] dark:text-gray-100">{a.serviceName}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{a.salonName}</p>
                  </div>
                  <Badge className={STATUS_STYLES[a.status] ?? ""}>{a.status}</Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} /> {a.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> {a.time}
                  </span>
                  <span className="flex items-center gap-1">
                    {a.paymentMethod === "pay_now" ? <CreditCard size={14} /> : <Banknote size={14} />}
                    {a.paymentMethod === "pay_now" ? `Paid $${parseFloat(a.price).toFixed(2)}` : `$${parseFloat(a.price).toFixed(2)} due`}
                  </span>
                  {a.pointsAwarded > 0 && (
                    <span className="flex items-center gap-1 text-[#d4af37] dark:text-amber-400">
                      <Award size={14} /> {a.pointsAwarded} pts earned
                    </span>
                  )}
                </div>

                {a.status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancel(a.id)}
                    className="border-red-300 dark:border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mt-1"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
