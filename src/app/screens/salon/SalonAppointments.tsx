import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2, Calendar, Clock, Banknote, CreditCard } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { getSalonAppointments, updateSalonAppointmentStatus, type SalonAppointment } from "../../lib/apiClient";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  confirmed: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  declined: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  cancelled: "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
};

export function SalonAppointments() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [appointments, setAppointments] = useState<SalonAppointment[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    if (!auth.idToken) return;
    return getSalonAppointments(auth.idToken).then(setAppointments);
  };

  useEffect(() => {
    load()?.catch(() => setLoadError(true));
  }, [auth.idToken]);

  const handleStatus = async (id: string, status: "confirmed" | "declined" | "cancelled") => {
    if (!auth.idToken) return;
    try {
      await updateSalonAppointmentStatus(auth.idToken, id, status);
      toast.success(`Booking ${status}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update this booking.");
    }
  };

  const pendingCount = appointments?.filter((a) => a.status === "pending").length ?? 0;

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 pb-6">
      <div className="bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/30 dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-[#2d2d2d] dark:text-gray-100" />
          </button>
          <h1 className="text-2xl text-[#2d2d2d] dark:text-gray-100">Appointments</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm pl-14">
          {pendingCount > 0 ? `${pendingCount} awaiting your response` : "Client bookings"}
        </p>
      </div>

      <div className="px-6 mt-6">
        {loadError ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">
            Couldn't load appointments right now.
          </p>
        ) : appointments === null ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[#d4af37] dark:text-amber-400" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No appointments yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Bookings from clients will show up here
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
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {a.clientName} - {a.clientEmail}
                    </p>
                  </div>
                  <Badge className={STATUS_STYLES[a.status] ?? ""}>{a.status}</Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
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
                </div>

                {a.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleStatus(a.id, "confirmed")}
                      className="bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-amber-400 dark:to-amber-500 text-[#2d2d2d] dark:text-gray-900 hover:opacity-90 rounded-lg"
                    >
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatus(a.id, "declined")}
                      className="border-red-300 dark:border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      Decline
                    </Button>
                  </div>
                )}
                {a.status === "confirmed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatus(a.id, "cancelled")}
                    className="border-red-300 dark:border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
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
