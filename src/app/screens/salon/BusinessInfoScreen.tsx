import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Store, User, Mail, Phone, MapPin, Save, Loader2, Camera } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import {
  getMe,
  updateMe,
  getSalonMe,
  updateSalonMe,
  uploadImage,
  updateSalonLogo,
  type MeResponse,
  type SalonMeResponse,
} from "../../lib/apiClient";

export function BusinessInfoScreen() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [salon, setSalon] = useState<SalonMeResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [salonName, setSalonName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const resetFormFrom = (meData: MeResponse, salonData: SalonMeResponse) => {
    setSalonName(salonData.name);
    setOwnerName(meData.name);
    setEmail(salonData.email ?? "");
    setPhone(salonData.phone ?? "");
    setAddress(salonData.address ?? "");
  };

  useEffect(() => {
    if (!auth.idToken) return;
    Promise.all([getMe(auth.idToken), getSalonMe(auth.idToken)])
      .then(([meData, salonData]) => {
        setMe(meData);
        setSalon(salonData);
        resetFormFrom(meData, salonData);
      })
      .catch(() => setLoadError(true));
  }, [auth.idToken]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.idToken || !salon) return;
    setSaveError(null);
    setIsSaving(true);

    try {
      const [updatedMe, updatedSalon] = await Promise.all([
        updateMe(auth.idToken, ownerName, me?.phone ?? null),
        updateSalonMe(auth.idToken, {
          name: salonName,
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          description: salon.description,
        }),
      ]);
      setMe(updatedMe);
      setSalon(updatedSalon);
      setIsEditing(false);
      toast.success("Business information updated successfully!");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong saving this information.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (me && salon) resetFormFrom(me, salon);
    setSaveError(null);
    setIsEditing(false);
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !auth.idToken) return;

    setIsUploadingLogo(true);
    try {
      const publicUrl = await uploadImage(auth.idToken, "salon-logo", file);
      const updated = await updateSalonLogo(auth.idToken, publicUrl);
      setSalon(updated);
      toast.success("Salon logo updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update your salon logo.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 px-8">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Couldn't load your business information right now. Please try again later.
        </p>
      </div>
    );
  }

  if (!me || !salon) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <Loader2 size={32} className="animate-spin text-[#d4af37] dark:text-amber-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/30 dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-[#2d2d2d] dark:text-gray-100" />
          </button>
          <h1 className="text-2xl text-[#2d2d2d] dark:text-gray-100">Business Information</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm pl-14">
          Update your salon details
        </p>
      </div>

      <div className="px-6 mt-6">
        {/* Business Logo */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <ImageWithFallback
              src={salon.image ?? ""}
              alt={salon.name}
              className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-lg"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleLogoChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingLogo}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#d4af37] to-[#f5e6c3] dark:from-amber-500 dark:to-yellow-500 flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-md disabled:opacity-60"
            >
              {isUploadingLogo ? (
                <Loader2 size={16} className="text-white animate-spin" />
              ) : (
                <Camera size={16} className="text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* Salon Name */}
          <div>
            <label className="flex items-center gap-2 text-sm mb-2 text-gray-600 dark:text-gray-300">
              <Store size={18} className="text-[#d4af37] dark:text-amber-400" />
              Salon Name
            </label>
            <Input
              type="text"
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              disabled={!isEditing}
              className="h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
              required
            />
          </div>

          {/* Owner Name */}
          <div>
            <label className="flex items-center gap-2 text-sm mb-2 text-gray-600 dark:text-gray-300">
              <User size={18} className="text-[#d4af37] dark:text-amber-400" />
              Owner Name
            </label>
            <Input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              disabled={!isEditing}
              className="h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
              required
            />
          </div>

          {/* Business Email - separate from the owner's login email */}
          <div>
            <label className="flex items-center gap-2 text-sm mb-2 text-gray-600 dark:text-gray-300">
              <Mail size={18} className="text-[#d4af37] dark:text-amber-400" />
              Business Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!isEditing}
              className="h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="flex items-center gap-2 text-sm mb-2 text-gray-600 dark:text-gray-300">
              <Phone size={18} className="text-[#d4af37] dark:text-amber-400" />
              Business Phone
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!isEditing}
              className="h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Address */}
          <div>
            <label className="flex items-center gap-2 text-sm mb-2 text-gray-600 dark:text-gray-300">
              <MapPin size={18} className="text-[#d4af37] dark:text-amber-400" />
              Business Address
            </label>
            <Input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={!isEditing}
              className="h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Enter your business address"
            />
          </div>

          {saveError && <p className="text-sm text-red-500 dark:text-red-400">{saveError}</p>}

          {/* Action Buttons */}
          <div className="pt-4">
            {!isEditing ? (
              <Button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-full h-12 bg-gradient-to-r from-[#f5e6c3] to-[#d4af37] dark:from-amber-500 dark:to-yellow-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-xl"
              >
                Edit Business Information
              </Button>
            ) : (
              <div className="space-y-3">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="w-full h-12 bg-gradient-to-r from-[#f5e6c3] to-[#d4af37] dark:from-amber-500 dark:to-yellow-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-xl flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  Save Changes
                </Button>
                <Button
                  type="button"
                  onClick={handleCancel}
                  variant="outline"
                  className="w-full h-12 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </form>

        {/* Business Info */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            <strong>Business Profile:</strong> This information is displayed to customers and used for business communications. Keep it accurate and up-to-date.
          </p>
        </div>
      </div>
    </div>
  );
}
