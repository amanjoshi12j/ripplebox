import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, User, Mail, Phone, Save, Loader2, Camera } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { getMe, updateMe, uploadImage, updateMyAvatar, type MeResponse } from "../../lib/apiClient";

export function PersonalInfoScreen() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.idToken) return;
    getMe(auth.idToken)
      .then((data) => {
        setMe(data);
        setName(data.name);
        setPhone(data.phone ?? "");
      })
      .catch(() => setLoadError(true));
  }, [auth.idToken]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.idToken) return;
    setSaveError(null);
    setIsSaving(true);

    try {
      const updated = await updateMe(auth.idToken, name, phone.trim() || null);
      setMe(updated);
      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong saving your profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file || !auth.idToken) return;

    setIsUploadingAvatar(true);
    try {
      const publicUrl = await uploadImage(auth.idToken, "avatar", file);
      const updated = await updateMyAvatar(auth.idToken, publicUrl);
      setMe(updated);
      toast.success("Profile photo updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update your photo.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCancel = () => {
    if (me) {
      setName(me.name);
      setPhone(me.phone ?? "");
    }
    setSaveError(null);
    setIsEditing(false);
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 px-8">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Couldn't load your profile right now. Please try again later.
        </p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <Loader2 size={32} className="animate-spin text-[#e6d7f5] dark:text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-[#2d2d2d] dark:text-gray-100" />
          </button>
          <h1 className="text-2xl text-[#2d2d2d] dark:text-gray-100">Personal Information</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm pl-14">
          Update your personal details
        </p>
      </div>

      <div className="px-6 mt-6">
        {/* Profile Picture */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <ImageWithFallback
              src={me.avatar ?? ""}
              alt={me.name}
              className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-lg"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-md disabled:opacity-60"
            >
              {isUploadingAvatar ? (
                <Loader2 size={16} className="text-white animate-spin" />
              ) : (
                <Camera size={16} className="text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="flex items-center gap-2 text-sm mb-2 text-gray-600 dark:text-gray-300">
              <User size={18} className="text-[#e6d7f5] dark:text-purple-400" />
              Full Name
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isEditing}
              className="h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
              required
            />
          </div>

          {/* Email - read-only, it's the login username */}
          <div>
            <label className="flex items-center gap-2 text-sm mb-2 text-gray-600 dark:text-gray-300">
              <Mail size={18} className="text-[#e6d7f5] dark:text-purple-400" />
              Email Address
            </label>
            <Input
              type="email"
              value={me.email}
              disabled
              className="h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="flex items-center gap-2 text-sm mb-2 text-gray-600 dark:text-gray-300">
              <Phone size={18} className="text-[#e6d7f5] dark:text-purple-400" />
              Phone Number
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!isEditing}
              className="h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {saveError && <p className="text-sm text-red-500 dark:text-red-400">{saveError}</p>}

          {/* Action Buttons */}
          <div className="pt-4">
            {!isEditing ? (
              <Button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-full h-12 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-xl"
              >
                Edit Information
              </Button>
            ) : (
              <div className="space-y-3">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="w-full h-12 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-xl flex items-center justify-center gap-2"
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

        {/* Account Info */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            <strong>Account Security:</strong> Your email is your login username and can't be changed here.
          </p>
        </div>
      </div>
    </div>
  );
}
