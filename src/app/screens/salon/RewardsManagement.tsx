import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Gift, Percent, DollarSign, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import {
  getSalonRewardsManage,
  createSalonReward,
  updateSalonReward,
  deleteSalonReward,
  getSalonProductsManage,
  type ManagedReward,
  type ManagedProduct,
} from "../../lib/apiClient";

const CATEGORIES = ["discount", "credit", "freebie"] as const;

interface RewardForm {
  title: string;
  description: string;
  pointsCost: string;
  category: string;
  discountPercent: string;
  freeProductId: string;
}

const emptyForm: RewardForm = {
  title: "",
  description: "",
  pointsCost: "",
  category: "",
  discountPercent: "",
  freeProductId: "",
};

export function RewardsManagement() {
  const auth = useAuth();
  const [rewards, setRewards] = useState<ManagedReward[] | null>(null);
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [totalRedeemed, setTotalRedeemed] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RewardForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadRewards = () => {
    if (!auth.idToken) return;
    return getSalonRewardsManage(auth.idToken).then((data) => {
      setRewards(data.rewards);
      setTotalRedeemed(data.totalRedeemed);
    });
  };

  useEffect(() => {
    loadRewards()?.catch(() => setLoadError(true));
    if (auth.idToken) {
      getSalonProductsManage(auth.idToken)
        .then(setProducts)
        .catch(() => {
          // Non-fatal - the freebie product picker just won't have options;
          // discount/credit rewards don't need this at all.
        });
    }
  }, [auth.idToken]);

  const getTypeIcon = (category: string | null) => {
    switch (category) {
      case "discount":
        return <Percent size={20} className="text-[#e6d7f5] dark:text-amber-400" />;
      case "credit":
        return <DollarSign size={20} className="text-[#d4af37] dark:text-amber-400" />;
      case "freebie":
        return <Gift size={20} className="text-[#f5d7e3] dark:text-amber-400" />;
      default:
        return <Gift size={20} />;
    }
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (reward: ManagedReward) => {
    setEditingId(reward.id);
    setForm({
      title: reward.title,
      description: reward.description ?? "",
      pointsCost: String(reward.pointsCost),
      category: reward.category ?? "",
      discountPercent: reward.discountPercent !== null ? String(reward.discountPercent) : "",
      freeProductId: reward.freeProductId ?? "",
    });
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!auth.idToken) return;
    setFormError(null);

    const pointsCost = parseInt(form.pointsCost, 10);
    if (!form.title.trim()) {
      setFormError("Reward name is required.");
      return;
    }
    if (!Number.isInteger(pointsCost) || pointsCost <= 0) {
      setFormError("Points required must be a positive number.");
      return;
    }
    let discountPercent: number | null = null;
    if (form.category === "discount") {
      discountPercent = parseInt(form.discountPercent, 10);
      if (!Number.isInteger(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
        setFormError("Discount % must be between 1 and 100.");
        return;
      }
    }
    let freeProductId: string | null = null;
    if (form.category === "freebie") {
      if (!form.freeProductId) {
        setFormError("Please choose which product this reward gives away.");
        return;
      }
      freeProductId = form.freeProductId;
    }

    setIsSaving(true);
    try {
      const input = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        pointsCost,
        category: form.category || null,
        discountPercent,
        freeProductId,
      };

      if (editingId) {
        const existing = rewards?.find((r) => r.id === editingId);
        await updateSalonReward(auth.idToken, editingId, { ...input, isActive: existing?.isActive ?? true });
        toast.success("Reward updated");
      } else {
        await createSalonReward(auth.idToken, input);
        toast.success("Reward created");
      }
      setIsDialogOpen(false);
      await loadRewards();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong saving this reward.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRewardStatus = async (reward: ManagedReward) => {
    if (!auth.idToken) return;
    try {
      await updateSalonReward(auth.idToken, reward.id, {
        title: reward.title,
        description: reward.description,
        pointsCost: reward.pointsCost,
        category: reward.category,
        discountPercent: reward.discountPercent,
        freeProductId: reward.freeProductId,
        isActive: !reward.isActive,
      });
      await loadRewards();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update this reward.");
    }
  };

  const handleDelete = async (reward: ManagedReward) => {
    if (!auth.idToken) return;
    try {
      await deleteSalonReward(auth.idToken, reward.id);
      toast.success("Reward deleted");
      await loadRewards();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete this reward.");
    }
  };

  const activeCount = rewards?.filter((r) => r.isActive).length ?? 0;

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/30 dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <h1 className="text-2xl mb-2 text-[#2d2d2d] dark:text-gray-100">Rewards Management</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Create and manage loyalty rewards</p>
      </div>

      <div className="px-6 mt-6">
        {/* Create reward button */}
        <Button
          onClick={openCreateDialog}
          className="w-full h-12 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-amber-400 dark:to-amber-500 text-[#2d2d2d] dark:text-gray-900 hover:opacity-90 rounded-xl mb-6"
        >
          <Plus size={20} className="mr-2" />
          Create New Reward
        </Button>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gradient-to-br from-[#e6d7f5] to-[#f5f0fc] dark:from-gray-800 dark:to-gray-700 rounded-2xl p-4">
            <h3 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{activeCount}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">Active Rewards</p>
          </div>
          <div className="bg-gradient-to-br from-[#f5d7e3] to-[#fef3f7] dark:from-gray-800 dark:to-gray-700 rounded-2xl p-4">
            <h3 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{totalRedeemed}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">Total Redeemed</p>
          </div>
        </div>

        {/* Rewards list */}
        {loadError ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">
            Couldn't load rewards right now. Please try again later.
          </p>
        ) : rewards === null ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[#d4af37] dark:text-amber-400" />
          </div>
        ) : rewards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No rewards yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Create your first reward to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-700 dark:to-gray-600 flex items-center justify-center flex-shrink-0">
                    {getTypeIcon(reward.category)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm mb-1 text-[#2d2d2d] dark:text-gray-100">{reward.title}</h4>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="bg-[#f5d7e3]/30 dark:bg-gray-700 text-[#2d2d2d] dark:text-gray-100 text-xs"
                          >
                            {reward.pointsCost} points
                          </Badge>
                          {reward.discountPercent !== null && (
                            <Badge
                              variant="secondary"
                              className="bg-[#e6d7f5]/30 dark:bg-gray-700 text-[#2d2d2d] dark:text-gray-100 text-xs"
                            >
                              {reward.discountPercent}% off
                            </Badge>
                          )}
                          {reward.freeProductName && (
                            <Badge
                              variant="secondary"
                              className="bg-[#f5d7e3]/30 dark:bg-gray-700 text-[#2d2d2d] dark:text-gray-100 text-xs"
                            >
                              Free: {reward.freeProductName}
                            </Badge>
                          )}
                          <Badge
                            variant={reward.isActive ? "default" : "secondary"}
                            className={
                              reward.isActive
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs"
                            }
                          >
                            {reward.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(reward)}
                        className="border-[#e6d7f5] dark:border-amber-400 text-[#e6d7f5] dark:text-amber-400 hover:bg-[#f5f0fc] dark:hover:bg-gray-700 rounded-lg"
                      >
                        <Edit2 size={14} className="mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleRewardStatus(reward)}
                        className={
                          reward.isActive
                            ? "border-orange-300 dark:border-orange-400 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg"
                            : "border-green-300 dark:border-green-400 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                        }
                      >
                        {reward.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(reward)}
                        className="border-red-300 dark:border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg ml-auto"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">
              {editingId ? "Edit Reward" : "Create New Reward"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="dark:text-gray-100">Reward Name</Label>
              <Input
                placeholder="e.g., 20% Off Service"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              />
            </div>
            <div>
              <Label className="dark:text-gray-100">Description (optional)</Label>
              <Input
                placeholder="e.g., 20% off any service"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              />
            </div>
            <div>
              <Label className="dark:text-gray-100">Type</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="dark:text-gray-100 dark:focus:bg-gray-700">
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.category === "discount" && (
              <div>
                <Label className="dark:text-gray-100">Discount %</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  placeholder="20"
                  value={form.discountPercent}
                  onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                  className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Applied automatically when a client books using this redeemed reward
                </p>
              </div>
            )}
            {form.category === "freebie" && (
              <div>
                <Label className="dark:text-gray-100">Product</Label>
                {products.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Add a product first (Settings → Products) before creating a freebie reward.
                  </p>
                ) : (
                  <>
                    <Select
                      value={form.freeProductId}
                      onValueChange={(v) => setForm((f) => ({ ...f, freeProductId: v }))}
                    >
                      <SelectTrigger className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
                        <SelectValue placeholder="Choose a product" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="dark:text-gray-100 dark:focus:bg-gray-700">
                            {p.name} (${parseFloat(p.price).toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Which product a client gets for redeeming this reward
                    </p>
                  </>
                )}
              </div>
            )}
            <div>
              <Label className="dark:text-gray-100">Points Required</Label>
              <Input
                type="number"
                min="1"
                placeholder="100"
                value={form.pointsCost}
                onChange={(e) => setForm((f) => ({ ...f, pointsCost: e.target.value }))}
                className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              />
            </div>
            {formError && <p className="text-sm text-red-500 dark:text-red-400">{formError}</p>}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-amber-400 dark:to-amber-500 text-[#2d2d2d] dark:text-gray-900 hover:opacity-90 flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {editingId ? "Save Changes" : "Create Reward"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
