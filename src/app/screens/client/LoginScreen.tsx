import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Sparkles, User, Store, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { login as cognitoLogin, confirmMfaCode } from "../../lib/authConfig";
import { useAuth } from "../../context/AuthContext";

function roleFromIdToken(idToken: string): string {
  const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  return payload["custom:role"];
}

function roleMatchesLoginType(actualRole: string, loginType: "user" | "salon" | null): boolean {
  return loginType === "salon" ? actualRole === "salon_owner" : actualRole !== "salon_owner";
}

function wrongPersonaMessage(actualRole: string): string {
  return actualRole === "salon_owner"
    ? 'This account is registered as a salon owner. Please use "Sign in as Salon Owner" instead.'
    : 'This account is registered as a client. Please use "Sign in as User" instead.';
}

export function LoginScreen() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const justReset = searchParams.get("reset") === "1";
  const [loginType, setLoginType] = useState<"user" | "salon" | null>(null);
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set only when Cognito challenges the login for a 2FA code instead of
  // returning tokens directly - see login()'s LoginResult union.
  const [mfaChallenge, setMfaChallenge] = useState<{ session: string; username: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await cognitoLogin(emailOrPhone, password);
      if (result.status === "mfa_required") {
        setMfaChallenge({ session: result.session, username: result.username });
        return;
      }

      // The credentials are valid, but make sure the account's real role
      // matches the tab they signed in on - correct creds for the other
      // persona shouldn't silently drop them into the wrong dashboard.
      const actualRole = roleFromIdToken(result.tokens.idToken);
      if (!roleMatchesLoginType(actualRole, loginType)) {
        setError(wrongPersonaMessage(actualRole));
        return;
      }

      auth.login(result.tokens);
      navigate(actualRole === "salon_owner" ? "/salon" : "/client");
    } catch (err) {
      const code = err instanceof Error ? err.name : "";
      if (code === "UserNotConfirmedException") {
        setError("Your account isn't verified yet. Please check your email for a confirmation code, or sign up again to resend one.");
      } else if (code === "NotAuthorizedException") {
        setError("Incorrect email or password.");
      } else if (code === "UserNotFoundException") {
        setError("No account found with that email.");
      } else {
        setError("Something went wrong signing you in. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const tokens = await confirmMfaCode(mfaChallenge.username, mfaChallenge.session, mfaCode.trim());

      const actualRole = roleFromIdToken(tokens.idToken);
      if (!roleMatchesLoginType(actualRole, loginType)) {
        setError(wrongPersonaMessage(actualRole));
        setMfaChallenge(null);
        return;
      }

      auth.login(tokens);
      navigate(actualRole === "salon_owner" ? "/salon" : "/client");
    } catch (err) {
      const code = err instanceof Error ? err.name : "";
      if (code === "CodeMismatchException") {
        setError("That code is incorrect. Please check your authenticator app and try again.");
      } else if (code === "ExpiredCodeException" || code === "NotAuthorizedException") {
        setError("That code expired. Please sign in again.");
        setMfaChallenge(null);
      } else {
        setError("Something went wrong verifying your code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mfaChallenge) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto">
        <div className="flex-1 flex flex-col justify-center px-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center shadow-lg">
              <ShieldCheck size={40} className="text-white" />
            </div>
            <h1 className="text-3xl mb-2 text-[#2d2d2d] dark:text-gray-100">Two-factor code</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              className="h-12 rounded-xl bg-[#f8f8f8] dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0 text-center tracking-widest"
              required
              autoFocus
            />

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 transition-opacity rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              Verify & Sign In
            </Button>
          </form>

          <Button
            onClick={() => {
              setMfaChallenge(null);
              setMfaCode("");
              setError(null);
            }}
            variant="ghost"
            className="w-full mt-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Back to login
          </Button>
        </div>
      </div>
    );
  }

  if (!loginType) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto">
        <div className="flex-1 flex flex-col justify-center px-8">
          {/* Logo */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center shadow-lg">
              <Sparkles size={40} className="text-white" />
            </div>
            <h1 className="text-3xl mb-2 text-[#2d2d2d] dark:text-gray-100">Welcome back</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Choose how you'd like to sign in</p>
          </div>

          {/* Login type selection */}
          <div className="space-y-4">
            <Button
              onClick={() => setLoginType("user")}
              className="w-full h-20 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 transition-opacity rounded-2xl flex items-center justify-center gap-3"
            >
              <User size={28} />
              <div className="text-left">
                <div className="text-base">Sign in as User</div>
                <div className="text-xs opacity-70">Book appointments & earn rewards</div>
              </div>
            </Button>

            <Button
              onClick={() => setLoginType("salon")}
              variant="outline"
              className="w-full h-20 border-2 border-[#d4af37] dark:border-amber-500 text-[#d4af37] dark:text-amber-400 hover:bg-[#f5e6c3]/20 dark:hover:bg-amber-500/20 rounded-2xl flex items-center justify-center gap-3"
            >
              <Store size={28} />
              <div className="text-left">
                <div className="text-base">Sign in as Salon Owner</div>
                <div className="text-xs opacity-70">Manage your salon & campaigns</div>
              </div>
            </Button>
          </div>

          {/* Sign up link */}
          <p className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/signup")}
              className="text-[#e6d7f5] dark:text-purple-400 hover:underline"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto">
      <div className="flex-1 flex flex-col justify-center px-8">
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center shadow-lg">
            <Sparkles size={40} className="text-white" />
          </div>
          <h1 className="text-3xl mb-2 text-[#2d2d2d] dark:text-gray-100">
            {loginType === "salon" ? "Salon Owner Login" : "User Login"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Sign in to continue</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
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

          <button
            type="button"
            onClick={() => navigate(`/forgot-password${emailOrPhone ? `?email=${encodeURIComponent(emailOrPhone)}` : ""}`)}
            className="text-sm text-[#e6d7f5] dark:text-purple-400 hover:underline"
          >
            Forgot password?
          </button>

          {justReset && !error && (
            <p className="text-sm text-green-600 dark:text-green-400">
              Password reset! Sign in with your new password.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className={`w-full h-14 ${
              loginType === "salon"
                ? "bg-gradient-to-r from-[#f5e6c3] to-[#d4af37] dark:from-amber-500 dark:to-yellow-500 text-[#2d2d2d] dark:text-white"
                : "bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white"
            } hover:opacity-90 transition-opacity rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2`}
          >
            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
            Sign In
          </Button>
        </form>

        {/* Back button */}
        <Button
          onClick={() => setLoginType(null)}
          variant="ghost"
          className="w-full mt-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Back to login options
        </Button>

        {/* Sign up link */}
        <p className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
          Don't have an account?{" "}
          <button
            onClick={() => navigate("/signup")}
            className="text-[#e6d7f5] dark:text-purple-400 hover:underline"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}
