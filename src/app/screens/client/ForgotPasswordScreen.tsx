import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { KeyRound, MailCheck, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { forgotPassword, confirmForgotPassword } from "../../lib/authConfig";

type Step = "request" | "reset";

export function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setStep("reset");
    } catch (err) {
      const code = err instanceof Error ? err.name : "";
      if (code === "UserNotFoundException") {
        setError("No account found with that email.");
      } else if (code === "LimitExceededException") {
        setError("Too many attempts. Please wait a bit before trying again.");
      } else {
        setError("Something went wrong sending the reset code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await confirmForgotPassword(email.trim(), code.trim(), newPassword);
      navigate(`/login?reset=1`);
    } catch (err) {
      const errCode = err instanceof Error ? err.name : "";
      if (errCode === "CodeMismatchException") {
        setError("That code is incorrect. Please check your email and try again.");
      } else if (errCode === "ExpiredCodeException") {
        setError("That code has expired. Request a new one below.");
      } else if (errCode === "InvalidPasswordException") {
        setError("Password must be at least 8 characters.");
      } else if (errCode === "LimitExceededException") {
        setError("Too many attempts. Please wait a bit before trying again.");
      } else {
        setError("Something went wrong resetting your password. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    try {
      await forgotPassword(email.trim());
    } catch {
      // Non-fatal - the person can just try submitting again below.
    }
  };

  if (step === "reset") {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center px-8 py-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center shadow-lg">
              <MailCheck size={40} className="text-white" />
            </div>
            <h1 className="text-3xl mb-2 text-[#2d2d2d] dark:text-gray-100">Check your email</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              We sent a reset code to {email}
            </p>
          </div>

          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Reset Code</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0 text-center tracking-widest"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">New Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0"
                required
              />
            </div>

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 transition-opacity rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              Reset Password
            </Button>
          </form>

          <button
            onClick={handleResend}
            className="text-center mt-6 text-sm text-[#e6d7f5] dark:text-purple-400 hover:underline mx-auto block"
          >
            Resend code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto">
      <div className="flex-1 flex flex-col justify-center px-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center shadow-lg">
            <KeyRound size={40} className="text-white" />
          </div>
          <h1 className="text-3xl mb-2 text-[#2d2d2d] dark:text-gray-100">Reset your password</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Enter your email and we'll send you a reset code
          </p>
        </div>

        <form onSubmit={handleRequestSubmit} className="space-y-4">
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

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-14 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 transition-opacity rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
            Send Reset Code
          </Button>
        </form>

        <Button
          onClick={() => navigate("/login")}
          variant="ghost"
          className="w-full mt-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Back to login
        </Button>
      </div>
    </div>
  );
}
