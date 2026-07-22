import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Sparkles, User, Store, Check, CreditCard, Building2, Loader2, MailCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { signUp, confirmSignUp, resendConfirmationCode, loginExpectingSuccess } from "../../lib/authConfig";
import { applyReferral, getSalons, type SalonSummary } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";

type SignupType = "user" | "salon" | null;
type SignupStep = "type" | "info" | "verify" | "plan" | "payment";
type SubscriptionPlan = "starter" | "professional" | "enterprise" | null;

export function SignupScreen() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  // A shared referral link (from ReferralScreen) encodes both the code and
  // its target salon. A manually-typed code has no salon context from a
  // link, so the form asks for one directly - see the salon picker below.
  const referredByLinkSalonId = searchParams.get("salon");
  const [salons, setSalons] = useState<SalonSummary[]>([]);
  const [manualReferralSalonId, setManualReferralSalonId] = useState("");
  const [step, setStep] = useState<SignupStep>("type");
  const [signupType, setSignupType] = useState<SignupType>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [salonName, setSalonName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  useEffect(() => {
    const urlRef = searchParams.get("ref");
    if (urlRef) setReferralCode(urlRef);
  }, [searchParams]);

  useEffect(() => {
    // Only needed for the manual-entry salon picker below (a link-based
    // referral already carries its salon in the URL) - fetch regardless of
    // signup type since it's cheap and public, avoids a load delay if
    // someone types a code right after picking "user".
    getSalons()
      .then(setSalons)
      .catch(() => {
        // Non-fatal - the manual salon picker just won't have options; the
        // referral code field still works fine for someone who arrived via
        // a link, which doesn't need this list at all.
      });
  }, []);

  const subscriptionPlans = [
    {
      id: "starter",
      name: "Starter",
      price: 29,
      features: ["Up to 100 clients", "Basic analytics", "Email support", "2 active campaigns"],
      popular: false,
    },
    {
      id: "professional",
      name: "Professional",
      price: 79,
      features: ["Up to 500 clients", "Advanced analytics", "Priority support", "Unlimited campaigns", "Custom branding"],
      popular: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: 199,
      features: ["Unlimited clients", "Full analytics suite", "24/7 phone support", "Unlimited campaigns", "API access", "Dedicated account manager"],
      popular: false,
    },
  ];

  const handleTypeSelection = (type: SignupType) => {
    setSignupType(type);
    setStep("info");
  };

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // A typed-in code with no link needs a salon picked here, or applying it
    // later would have nothing to attach the referral to (see applyReferral
    // in the backend, which requires a salonId) - same "already-in-progress
    // referral" this app has always required, just now impossible to skip.
    if (
      signupType === "user" &&
      referralCode.trim() &&
      !referredByLinkSalonId &&
      !manualReferralSalonId
    ) {
      setError("Please choose which salon this referral code is for.");
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp({
        email,
        password,
        name: signupType === "salon" ? name : name,
        phone,
        role: signupType === "salon" ? "salon_owner" : "client",
        salonName: signupType === "salon" ? salonName : undefined,
        businessAddress: signupType === "salon" ? businessAddress : undefined,
      });
      setStep("verify");
    } catch (err) {
      const code = err instanceof Error ? err.name : "";
      if (code === "UsernameExistsException") {
        // Cognito throws this even when the existing account was never
        // confirmed (e.g. the person closed the tab before entering their
        // code and is now retrying signup) - there's no way to tell from
        // this error alone whether they need to sign in or just need a
        // fresh code. Resending settles it: Cognito only allows a resend
        // for an unconfirmed account, so success here means "still
        // unconfirmed" and we can send them straight to the verify step
        // with a new code, rather than dead-ending on "already exists."
        try {
          await resendConfirmationCode(email);
          setStep("verify");
        } catch {
          setError("An account with that email already exists. Please sign in instead.");
        }
      } else if (code === "InvalidPasswordException") {
        setError("Password must be at least 8 characters.");
      } else {
        setError("Something went wrong creating your account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await confirmSignUp(email, verificationCode);

      if (signupType === "salon") {
        // Account is confirmed - plan/payment below are still cosmetic
        // (no billing integration yet), sign-in happens after that.
        setStep("plan");
      } else {
        const tokens = await loginExpectingSuccess(email, password);
        auth.login(tokens);

        const referralSalonId = referredByLinkSalonId || manualReferralSalonId;
        if (referralCode.trim() && referralSalonId) {
          // Best-effort - a bad/stale referral shouldn't block the person
          // from getting into the app they just signed up for.
          try {
            await applyReferral(tokens.idToken, referralCode.trim(), referralSalonId);
          } catch (referralErr) {
            console.error("Referral apply failed:", referralErr);
          }
        }

        navigate("/client");
      }
    } catch (err) {
      const code = err instanceof Error ? err.name : "";
      if (code === "CodeMismatchException") {
        setError("That code doesn't match. Please check and try again.");
      } else if (code === "ExpiredCodeException") {
        setError("That code has expired. Tap \"Resend code\" below for a new one.");
      } else {
        setError("Something went wrong verifying your account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setError(null);
    try {
      await resendConfirmationCode(email);
    } catch {
      setError("Couldn't resend the code. Please try again in a moment.");
    }
  };

  const handlePlanSelection = (planId: SubscriptionPlan) => {
    setSelectedPlan(planId);
    setStep("payment");
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Mock payment processing - the account itself is already confirmed
      // from the verify step, so this just signs them in.
      const tokens = await cognitoLogin(email, password);
      auth.login(tokens);
      navigate("/salon");
    } catch {
      setError("Payment saved, but we couldn't sign you in automatically. Please log in.");
      navigate("/login");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Choose signup type
  if (step === "type") {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto">
        <div className="flex-1 flex flex-col justify-center px-8">
          <div className="text-center mb-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center shadow-lg">
              <Sparkles size={40} className="text-white" />
            </div>
            <h1 className="text-3xl mb-2 text-[#2d2d2d] dark:text-gray-100">Join Ripplebox</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Choose how you'd like to join</p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={() => handleTypeSelection("user")}
              className="w-full h-20 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 transition-opacity rounded-2xl flex items-center justify-center gap-3"
            >
              <User size={28} />
              <div className="text-left">
                <div className="text-base">Sign up as User</div>
                <div className="text-xs opacity-70">Book appointments & earn rewards</div>
              </div>
            </Button>

            <Button
              onClick={() => handleTypeSelection("salon")}
              variant="outline"
              className="w-full h-20 border-2 border-[#d4af37] dark:border-amber-500 text-[#d4af37] dark:text-amber-400 hover:bg-[#f5e6c3]/20 dark:hover:bg-amber-500/20 rounded-2xl flex items-center justify-center gap-3"
            >
              <Store size={28} />
              <div className="text-left">
                <div className="text-base">Sign up as Salon Owner</div>
                <div className="text-xs opacity-70">Grow your business with referrals</div>
              </div>
            </Button>
          </div>

          <p className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-[#e6d7f5] dark:text-purple-400 hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Step 2: Account information
  if (step === "info") {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center px-8 py-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center shadow-lg">
              <Sparkles size={40} className="text-white" />
            </div>
            <h1 className="text-3xl mb-2 text-[#2d2d2d] dark:text-gray-100">
              {signupType === "salon" ? "Salon Information" : "Create Account"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {signupType === "salon" ? "Tell us about your salon" : "Start earning rewards today"}
            </p>
          </div>

          <form onSubmit={handleInfoSubmit} className="space-y-4">
            {signupType === "salon" && (
              <>
                <div>
                  <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Salon Name</label>
                  <Input
                    type="text"
                    placeholder="Luxury Beauty Spa"
                    value={salonName}
                    onChange={(e) => setSalonName(e.target.value)}
                    className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Business Address</label>
                  <Input
                    type="text"
                    placeholder="123 Main Street, City"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0"
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">
                {signupType === "salon" ? "Owner Name" : "Full Name"}
              </label>
              <Input
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Phone Number</label>
              <Input
                type="tel"
                placeholder="+1 (234) 567-8900"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0"
                required
              />
            </div>

            {signupType === "user" && (
              <div>
                <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">
                  Referral Code <span className="text-gray-400 dark:text-gray-500">(Optional)</span>
                </label>
                <Input
                  type="text"
                  placeholder="Enter code"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0"
                />

                {/* Referral rewards are per-salon, so a code typed in here
                    (rather than arriving via a shared link, which already
                    carries this) needs the salon spelled out too. */}
                {referralCode.trim() && !referredByLinkSalonId && (
                  <div className="mt-3">
                    <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">
                      Which salon is this code for?
                    </label>
                    <Select value={manualReferralSalonId} onValueChange={setManualReferralSalonId}>
                      <SelectTrigger className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 border-0 w-full">
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
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

            <Button
              type="submit"
              disabled={isSubmitting}
              className={`w-full h-14 ${
                signupType === "salon"
                  ? "bg-gradient-to-r from-[#f5e6c3] to-[#d4af37] dark:from-amber-500 dark:to-yellow-500"
                  : "bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500"
              } text-[#2d2d2d] dark:text-white hover:opacity-90 transition-opacity rounded-2xl mt-6 disabled:opacity-60 flex items-center justify-center gap-2`}
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              {signupType === "salon" ? "Continue to Plans" : "Create Account"}
            </Button>
          </form>

          <Button
            onClick={() => setStep("type")}
            variant="ghost"
            className="w-full mt-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Back
          </Button>

          <p className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-[#e6d7f5] dark:text-purple-400 hover:underline"
            >
              Sign in
            </button>
          </p>

          <p className="text-center mt-4 text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    );
  }

  // Step 2.5: Email verification (both types - Cognito requires a confirmed
  // account before sign-in works)
  if (step === "verify") {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center px-8 py-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center shadow-lg">
              <MailCheck size={40} className="text-white" />
            </div>
            <h1 className="text-3xl mb-2 text-[#2d2d2d] dark:text-gray-100">Check your email</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              We sent a verification code to {email}
            </p>
          </div>

          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Verification Code</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0 text-center tracking-widest"
                required
              />
            </div>

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

            <Button
              type="submit"
              disabled={isSubmitting}
              className={`w-full h-14 ${
                signupType === "salon"
                  ? "bg-gradient-to-r from-[#f5e6c3] to-[#d4af37] dark:from-amber-500 dark:to-yellow-500"
                  : "bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500"
              } text-[#2d2d2d] dark:text-white hover:opacity-90 transition-opacity rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2`}
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              Verify & Continue
            </Button>
          </form>

          <button
            onClick={handleResendCode}
            className="text-center mt-6 text-sm text-[#e6d7f5] dark:text-purple-400 hover:underline mx-auto block"
          >
            Resend code
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Subscription plan selection (salon only)
  if (step === "plan") {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto overflow-y-auto">
        <div className="flex-1 px-8 py-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#f5e6c3] to-[#d4af37] dark:from-amber-500 dark:to-yellow-500 flex items-center justify-center shadow-lg">
              <Building2 size={40} className="text-white" />
            </div>
            <h1 className="text-3xl mb-2 text-[#2d2d2d] dark:text-gray-100">Choose Your Plan</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Select the perfect plan for your salon</p>
          </div>

          <div className="space-y-4">
            {subscriptionPlans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => handlePlanSelection(plan.id as SubscriptionPlan)}
                className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all ${
                  plan.popular
                    ? "border-[#d4af37] dark:border-amber-400 bg-gradient-to-br from-[#f5e6c3]/20 to-[#d4af37]/10 dark:from-amber-900/20 dark:to-yellow-900/10"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-[#d4af37] dark:hover:border-amber-400"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#d4af37] to-[#f5e6c3] dark:from-amber-500 dark:to-yellow-500 text-white px-4 py-1 rounded-full text-xs">
                    Most Popular
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-xl mb-2 text-[#2d2d2d] dark:text-gray-100">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl text-[#2d2d2d] dark:text-gray-100">${plan.price}</span>
                    <span className="text-gray-500 dark:text-gray-400">/month</span>
                  </div>
                </div>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Check size={18} className="text-[#d4af37] dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <Button
            onClick={() => setStep("info")}
            variant="ghost"
            className="w-full mt-6 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  // Step 4: Payment information (salon only)
  if (step === "payment") {
    const plan = subscriptionPlans.find((p) => p.id === selectedPlan);

    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center px-8 py-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#f5e6c3] to-[#d4af37] dark:from-amber-500 dark:to-yellow-500 flex items-center justify-center shadow-lg">
              <CreditCard size={40} className="text-white" />
            </div>
            <h1 className="text-3xl mb-2 text-[#2d2d2d] dark:text-gray-100">Payment Details</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Complete your subscription</p>
          </div>

          {/* Plan summary */}
          <div className="bg-gradient-to-r from-[#f5e6c3] to-[#d4af37]/30 dark:from-amber-900/30 dark:to-yellow-900/20 rounded-2xl p-4 mb-6 border border-[#d4af37]/30 dark:border-amber-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#2d2d2d] dark:text-gray-100 mb-1">{plan?.name} Plan</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Billed monthly</p>
              </div>
              <div className="text-right">
                <p className="text-2xl text-[#2d2d2d] dark:text-gray-100">${plan?.price}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">/month</p>
              </div>
            </div>
          </div>

          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Card Number</label>
              <Input
                type="text"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Expiry Date</label>
                <Input
                  type="text"
                  placeholder="MM/YY"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">CVV</label>
                <Input
                  type="text"
                  placeholder="123"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0"
                  required
                />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mt-6">
              <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                🔒 Your payment information is encrypted and secure. You can cancel your subscription at any time.
              </p>
            </div>

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-gradient-to-r from-[#f5e6c3] to-[#d4af37] dark:from-amber-500 dark:to-yellow-500 text-[#2d2d2d] dark:text-white hover:opacity-90 transition-opacity rounded-2xl mt-6 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              Start Subscription - ${plan?.price}/month
            </Button>
          </form>

          <Button
            onClick={() => setStep("plan")}
            variant="ghost"
            className="w-full mt-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Back to Plans
          </Button>

          <p className="text-center mt-6 text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
            By completing this purchase, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    );
  }

  return null;
}
