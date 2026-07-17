import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { ArrowLeft, Loader2, CalendarCheck, CreditCard, Banknote } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { getStripe, isStripeConfigured } from "../../lib/stripeConfig";
import {
  getSalons,
  createAppointment,
  createPaymentIntent,
  type SalonSummary,
  type PaymentMethod,
} from "../../lib/apiClient";

const today = () => new Date().toISOString().slice(0, 10);

function CardPaymentStep({
  clientSecret,
  amount,
  onPaid,
  onBack,
}: {
  clientSecret: string;
  amount: number;
  onPaid: (paymentIntentId: string) => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { theme } = useTheme();
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;

    setError(null);
    setIsPaying(true);
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card },
    });
    setIsPaying(false);

    if (result.error) {
      setError(result.error.message ?? "Card payment failed. Please try again.");
      return;
    }
    if (result.paymentIntent?.status === "succeeded") {
      onPaid(result.paymentIntent.id);
    } else {
      setError("Payment could not be confirmed. Please try again.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Amount due now</p>
        <p className="text-2xl text-[#2d2d2d] dark:text-gray-100">${amount.toFixed(2)}</p>
      </div>

      <div>
        <Label className="dark:text-gray-100 mb-2 block">Card Details</Label>
        <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <CardElement
            key={theme}
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: theme === "dark" ? "#f3f4f6" : "#2d2d2d",
                  "::placeholder": { color: theme === "dark" ? "#9ca3af" : "#6b7280" },
                },
                invalid: { color: "#ef4444" },
              },
              // Stripe Link's inline autofill prompt asks for an email
              // unrelated to the RippleBox account the client is already
              // signed into - confusing here, so just show a plain card field.
              disableLink: true,
            }}
          />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Test mode - use card number 4242 4242 4242 4242, any future expiry, any CVC.
        </p>
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      <div className="space-y-2">
        <Button
          onClick={handlePay}
          disabled={!stripe || isPaying}
          className="w-full h-12 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-xl flex items-center justify-center gap-2"
        >
          {isPaying && <Loader2 size={18} className="animate-spin" />}
          Pay ${amount.toFixed(2)} & Book
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isPaying}
          className="w-full h-12 rounded-xl"
        >
          Back
        </Button>
      </div>
    </div>
  );
}

export function BookingScreen() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { id: salonId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const [salon, setSalon] = useState<SalonSummary | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);

  const [serviceId, setServiceId] = useState(searchParams.get("serviceId") ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pay_later");

  const [step, setStep] = useState<"form" | "payment" | "done">("form");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salonId) return;
    getSalons()
      .then((salons) => setSalon(salons.find((s) => s.id === salonId) ?? null))
      .catch(() => setLoadError(true));
  }, [salonId]);

  const selectedService = salon?.services.find((s) => s.id === serviceId);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.idToken || !salonId || !selectedService) return;
    setError(null);

    if (paymentMethod === "pay_later") {
      setIsSubmitting(true);
      try {
        await createAppointment(auth.idToken, {
          salonId,
          serviceId,
          date,
          time,
          paymentMethod: "pay_later",
        });
        setStep("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create this booking.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // pay_now - create the PaymentIntent first, then show the card form
    setIsSubmitting(true);
    try {
      const intent = await createPaymentIntent(auth.idToken, salonId, serviceId);
      setClientSecret(intent.clientSecret);
      setAmount(intent.amount);
      setStep("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaid = async (paymentIntentId: string) => {
    if (!auth.idToken || !salonId) return;
    setError(null);
    try {
      await createAppointment(auth.idToken, {
        salonId,
        serviceId,
        date,
        time,
        paymentMethod: "pay_now",
        paymentIntentId,
      });
      setStep("done");
    } catch (err) {
      // The card was already charged by Stripe at this point - surface this
      // clearly rather than silently losing the booking, since a retry would
      // create a second appointment record without a second charge.
      setError(
        (err instanceof Error ? err.message : "Couldn't save the booking") +
          " - your card was charged, please contact the salon to confirm your appointment."
      );
      setStep("form");
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <p className="text-gray-500 dark:text-gray-400">Couldn't load this salon right now.</p>
      </div>
    );
  }

  if (salon === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <Loader2 size={32} className="animate-spin text-[#e6d7f5] dark:text-purple-400" />
      </div>
    );
  }

  if (!salon) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <p className="text-gray-500 dark:text-gray-400">Salon not found</p>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center">
          <CalendarCheck size={32} className="text-white" />
        </div>
        <h1 className="text-2xl text-[#2d2d2d] dark:text-gray-100">Booking requested!</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {salon.name} will confirm your {selectedService?.name} appointment on {date} at {time}.
        </p>
        <Button
          onClick={() => navigate("/client/appointments")}
          className="w-full h-12 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-xl mt-4"
        >
          View My Appointments
        </Button>
        <Button variant="outline" onClick={() => navigate(-1)} className="w-full h-12 rounded-xl">
          Back to Salon
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pb-20">
      <div className="bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => (step === "payment" ? setStep("form") : navigate(-1))}
            className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-[#2d2d2d] dark:text-gray-100" />
          </button>
          <h1 className="text-2xl text-[#2d2d2d] dark:text-gray-100">Book Appointment</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm pl-14">{salon.name}</p>
      </div>

      <div className="px-6 mt-6">
        {step === "payment" && clientSecret ? (
          <Elements stripe={getStripe()}>
            <CardPaymentStep
              clientSecret={clientSecret}
              amount={amount}
              onPaid={handlePaid}
              onBack={() => setStep("form")}
            />
          </Elements>
        ) : (
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <Label className="dark:text-gray-100 mb-2 block">Service</Label>
              {salon.services.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This salon hasn't added any services yet.
                </p>
              ) : (
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger className="h-12 rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
                    <SelectValue placeholder="Choose a service" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                    {salon.services.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="dark:text-gray-100 dark:focus:bg-gray-700">
                        {s.name} - ${parseFloat(s.price).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label className="dark:text-gray-100 mb-2 block">Date</Label>
              <Input
                type="date"
                min={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                required
              />
            </div>

            <div>
              <Label className="dark:text-gray-100 mb-2 block">Time</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-12 rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                required
              />
            </div>

            <div>
              <Label className="dark:text-gray-100 mb-3 block">Payment</Label>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <label
                  htmlFor="pay_later"
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer"
                >
                  <RadioGroupItem value="pay_later" id="pay_later" />
                  <Banknote size={20} className="text-[#e6d7f5] dark:text-purple-400" />
                  <div>
                    <p className="text-sm text-[#2d2d2d] dark:text-gray-100">Pay Later</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Pay in person at the salon</p>
                  </div>
                </label>
                <label
                  htmlFor="pay_now"
                  className={`flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 ${
                    isStripeConfigured() ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <RadioGroupItem value="pay_now" id="pay_now" disabled={!isStripeConfigured()} />
                  <CreditCard size={20} className="text-[#e6d7f5] dark:text-purple-400" />
                  <div>
                    <p className="text-sm text-[#2d2d2d] dark:text-gray-100">Pay Now</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isStripeConfigured() ? "Pay by card now" : "Card payments coming soon"}
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

            <Button
              type="submit"
              disabled={isSubmitting || !serviceId || !date || !time}
              className="w-full h-14 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-2xl flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              {paymentMethod === "pay_now" ? "Continue to Payment" : "Request Booking"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
