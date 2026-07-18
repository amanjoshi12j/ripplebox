import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Lock, Loader2 } from "lucide-react";
import { Switch } from "./ui/switch";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { associateSoftwareToken, verifySoftwareToken, setMfaEnabled, getMfaEnabled } from "../lib/authConfig";

// Shared between SettingsScreen.tsx (client) and SalonSettings.tsx (salon
// owner) - the 2FA mechanics are identical for both, only the Cognito
// account differs (via useAuth()).
export function TwoFactorAuthCard({
  iconGradientClassName = "from-[#e6d7f5] to-[#f5f0fc] dark:from-purple-600 dark:to-indigo-600",
}: {
  iconGradientClassName?: string;
}) {
  const auth = useAuth();
  const [mfaEnabled, setMfaEnabledState] = useState<boolean | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.accessToken) return;
    getMfaEnabled(auth.accessToken)
      .then(setMfaEnabledState)
      .catch(() => setMfaEnabledState(false));
  }, [auth.accessToken]);

  const handleToggle = async (checked: boolean) => {
    if (!auth.accessToken) return;

    if (!checked) {
      // Turning off doesn't need re-verification - the user is already in
      // an authenticated session, same trust level as any other settings
      // change here.
      try {
        await setMfaEnabled(auth.accessToken, false);
        setMfaEnabledState(false);
        toast.success("Two-factor authentication turned off.");
      } catch {
        toast.error("Couldn't turn off two-factor authentication. Please try again.");
      }
      return;
    }

    // Turning on requires proving the authenticator app actually got set up
    // correctly first - see the dialog below.
    setError(null);
    setCode("");
    try {
      const secretCode = await associateSoftwareToken(auth.accessToken);
      setSecret(secretCode);
      setIsSettingUp(true);
    } catch {
      toast.error("Couldn't start two-factor setup. Please try again.");
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.accessToken) return;
    setError(null);
    setIsSaving(true);
    try {
      await verifySoftwareToken(auth.accessToken, code.trim());
      await setMfaEnabled(auth.accessToken, true);
      setMfaEnabledState(true);
      setIsSettingUp(false);
      toast.success("Two-factor authentication is on. You'll be asked for a code next time you sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const otpauthUrl = secret && auth.email
    ? `otpauth://totp/RippleBox:${encodeURIComponent(auth.email)}?secret=${secret}&issuer=RippleBox`
    : "";

  return (
    <>
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${iconGradientClassName} flex items-center justify-center`}>
            <Lock size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm text-[#2d2d2d] dark:text-gray-100">Two-Factor Auth</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {mfaEnabled === null ? "Checking..." : mfaEnabled ? "Enabled - via authenticator app" : "Extra security layer"}
            </p>
          </div>
        </div>
        {mfaEnabled === null ? (
          <Loader2 size={18} className="animate-spin text-gray-400" />
        ) : (
          <Switch checked={mfaEnabled} onCheckedChange={handleToggle} />
        )}
      </div>

      <Dialog open={isSettingUp} onOpenChange={(open) => !open && setIsSettingUp(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Scan this with an authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code it shows.
            </p>

            {otpauthUrl && (
              <div className="flex justify-center bg-white p-4 rounded-xl">
                <QRCodeSVG value={otpauthUrl} size={180} level="H" includeMargin={true} fgColor="#3a3a3a" />
              </div>
            )}

            <p className="text-xs text-gray-400 dark:text-gray-500 text-center break-all">
              Can't scan? Enter this code manually: {secret}
            </p>

            <form onSubmit={handleVerify} className="space-y-3">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-12 rounded-xl text-center tracking-widest"
                required
                autoFocus
              />

              {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="w-full h-12 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-xl flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />}
                  Confirm & Turn On
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
