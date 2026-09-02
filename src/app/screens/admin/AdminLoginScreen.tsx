import { useState } from "react";
import { useNavigate } from "react-router";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { login as cognitoLogin } from "../../lib/authConfig";
import { useAuth } from "../../context/AuthContext";

// No persona picker, no signup link - admin accounts are provisioned
// directly via AWS tooling (see aws_backend_infra notes), never through a
// public flow, so there's nothing to route to here besides sign-in.
export function AdminLoginScreen() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await cognitoLogin(email, password);
      if (result.status === "mfa_required") {
        setError("This account has 2FA enabled, which isn't supported on the admin login yet.");
        return;
      }

      auth.login(result.tokens);
      navigate("/admin");
    } catch (err) {
      const code = err instanceof Error ? err.name : "";
      if (code === "NotAuthorizedException") {
        setError("Incorrect email or password.");
      } else if (code === "UserNotFoundException") {
        setError("No admin account found with that email.");
      } else {
        setError("Something went wrong signing you in. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-[#eaf2fb] to-white dark:from-gray-900 dark:to-gray-800 max-w-md mx-auto">
      <div className="flex-1 flex flex-col justify-center px-8">
        <div className="text-center mb-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#6b8cae] to-[#a9c4de] dark:from-cyan-500 dark:to-blue-500 flex items-center justify-center shadow-lg">
            <ShieldCheck size={40} className="text-white" />
          </div>
          <h1 className="text-3xl mb-2 text-[#2d2d2d] dark:text-gray-100">RippleBox Admin</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Platform administration</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Email</label>
            <Input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-14 bg-gradient-to-r from-[#6b8cae] to-[#a9c4de] dark:from-cyan-500 dark:to-blue-500 text-white hover:opacity-90 transition-opacity rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
