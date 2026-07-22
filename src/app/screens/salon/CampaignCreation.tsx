import { useEffect, useState } from "react";
import { Plus, Calendar, Percent, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import {
  getSalonCampaigns,
  createSalonCampaign,
  updateSalonCampaign,
  getSalonServicesManage,
  type CampaignSummary,
  type ManagedService,
} from "../../lib/apiClient";

const TYPES = ["referral", "loyalty"] as const;

interface CampaignForm {
  name: string;
  type: string;
  discountPercent: string;
  serviceId: string;
  visitThreshold: string;
  startDate: string;
  endDate: string;
}

const emptyForm: CampaignForm = {
  name: "",
  type: "",
  discountPercent: "",
  serviceId: "any",
  visitThreshold: "",
  startDate: "",
  endDate: "",
};

export function CampaignCreation() {
  const auth = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [services, setServices] = useState<ManagedService[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadCampaigns = () => {
    if (!auth.idToken) return;
    return getSalonCampaigns(auth.idToken).then(setCampaigns);
  };

  useEffect(() => {
    if (!auth.idToken) return;
    loadCampaigns()?.catch(() => setLoadError(true));
    getSalonServicesManage(auth.idToken)
      .then(setServices)
      .catch(() => {
        // Non-fatal - campaigns can still be created "any service" without this.
      });
  }, [auth.idToken]);

  const getCampaignTypeColor = (type: string) => {
    switch (type) {
      case "referral":
        return "bg-[#e6d7f5]/20 dark:bg-amber-400/20 text-[#e6d7f5] dark:text-amber-400";
      case "loyalty":
        return "bg-[#d4af37]/20 dark:bg-amber-400/20 text-[#d4af37] dark:text-amber-400";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400";
    }
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (c: CampaignSummary) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      type: c.type,
      discountPercent: String(c.discountPercent),
      serviceId: c.serviceId ?? "any",
      visitThreshold: c.visitThreshold !== null ? String(c.visitThreshold) : "",
      startDate: c.startDate,
      endDate: c.endDate,
    });
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!auth.idToken) return;
    setFormError(null);

    if (!form.name.trim()) {
      setFormError("Campaign name is required.");
      return;
    }
    if (!TYPES.includes(form.type as (typeof TYPES)[number])) {
      setFormError("Please select a campaign type.");
      return;
    }
    const discountPercent = parseInt(form.discountPercent, 10);
    if (!Number.isInteger(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      setFormError("Discount % is required and must be between 1 and 100.");
      return;
    }
    let visitThreshold: number | null = null;
    if (form.type === "loyalty") {
      visitThreshold = parseInt(form.visitThreshold, 10);
      if (!Number.isInteger(visitThreshold) || visitThreshold <= 0) {
        setFormError("Please enter which visit number this discount applies on (e.g. 5).");
        return;
      }
    }
    if (!form.startDate || !form.endDate) {
      setFormError("Start and end dates are required.");
      return;
    }

    setIsSaving(true);
    try {
      const input = {
        name: form.name.trim(),
        type: form.type as (typeof TYPES)[number],
        discountPercent,
        serviceId: form.serviceId === "any" ? null : form.serviceId,
        visitThreshold,
        startDate: form.startDate,
        endDate: form.endDate,
      };

      if (editingId) {
        const existing = campaigns?.find((c) => c.id === editingId);
        await updateSalonCampaign(auth.idToken, editingId, { ...input, status: existing?.status ?? "active" });
        toast.success("Campaign updated");
      } else {
        await createSalonCampaign(auth.idToken, input);
        toast.success("Campaign created");
      }
      setIsDialogOpen(false);
      await loadCampaigns();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong saving this campaign.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (c: CampaignSummary) => {
    if (!auth.idToken) return;
    try {
      await updateSalonCampaign(auth.idToken, c.id, {
        name: c.name,
        type: c.type,
        discountPercent: c.discountPercent,
        serviceId: c.serviceId,
        visitThreshold: c.visitThreshold,
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status === "active" ? "paused" : "active",
      });
      await loadCampaigns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update this campaign.");
    }
  };

  const activeCount = campaigns?.filter((c) => c.status === "active").length ?? 0;
  const totalRedemptions = campaigns?.reduce((sum, c) => sum + c.redemptions, 0) ?? 0;

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/30 dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <h1 className="text-2xl mb-2 text-[#2d2d2d] dark:text-gray-100">Campaign Management</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Create and manage promotional campaigns</p>
      </div>

      <div className="px-6 mt-6">
        {/* Create campaign button */}
        <Button
          onClick={openCreateDialog}
          className="w-full h-12 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-amber-400 dark:to-amber-500 text-[#2d2d2d] dark:text-gray-900 hover:opacity-90 rounded-xl mb-6"
        >
          <Plus size={20} className="mr-2" />
          Create New Campaign
        </Button>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gradient-to-br from-[#e6d7f5] to-[#f5f0fc] dark:from-gray-800 dark:to-gray-700 rounded-2xl p-4">
            <h3 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{activeCount}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">Active Campaigns</p>
          </div>
          <div className="bg-gradient-to-br from-[#f5d7e3] to-[#fef3f7] dark:from-gray-800 dark:to-gray-700 rounded-2xl p-4">
            <h3 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{totalRedemptions}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">Total Redemptions</p>
          </div>
        </div>

        {/* Campaigns list */}
        {loadError ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">
            Couldn't load campaigns right now. Please try again later.
          </p>
        ) : campaigns === null ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[#d4af37] dark:text-amber-400" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No campaigns yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Create your first campaign to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-base mb-2 text-[#2d2d2d] dark:text-gray-100">{campaign.name}</h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getCampaignTypeColor(campaign.type)}>
                        {campaign.type === "referral" ? "Referral Bonus" : "Loyalty Reward"}
                      </Badge>
                      <Badge
                        className={
                          campaign.status === "active"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        }
                      >
                        {campaign.status === "active" ? (
                          <CheckCircle size={12} className="mr-1" />
                        ) : (
                          <XCircle size={12} className="mr-1" />
                        )}
                        {campaign.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {campaign.type === "loyalty" ? `On visit #${campaign.visitThreshold} · ` : ""}
                      {campaign.serviceName ? campaign.serviceName : "Any service"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-[#d4af37] dark:text-amber-400 mb-1">
                      <Percent size={16} />
                      <span className="text-lg">{campaign.discountPercent}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Discount</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <Calendar size={12} />
                      <span>Duration</span>
                    </div>
                    <p className="text-sm text-[#2d2d2d] dark:text-gray-100">
                      {new Date(campaign.startDate).toLocaleDateString()} -{" "}
                      {new Date(campaign.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <CheckCircle size={12} />
                      <span>Redemptions</span>
                    </div>
                    <p className="text-sm text-[#2d2d2d] dark:text-gray-100">{campaign.redemptions} times</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(campaign)}
                    className="border-[#e6d7f5] dark:border-amber-400 text-[#e6d7f5] dark:text-amber-400 hover:bg-[#f5f0fc] dark:hover:bg-gray-700 rounded-lg flex-1"
                  >
                    Edit
                  </Button>
                  {campaign.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleStatus(campaign)}
                      className="border-orange-300 dark:border-orange-400 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg flex-1"
                    >
                      Pause
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleStatus(campaign)}
                      className="border-green-300 dark:border-green-400 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg flex-1"
                    >
                      Activate
                    </Button>
                  )}
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
              {editingId ? "Edit Campaign" : "Create New Campaign"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="dark:text-gray-100">Campaign Name</Label>
              <Input
                placeholder="e.g., Spring Special"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              />
            </div>
            <div>
              <Label className="dark:text-gray-100">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  <SelectItem value="referral" className="dark:text-gray-100 dark:focus:bg-gray-700">Referral Bonus</SelectItem>
                  <SelectItem value="loyalty" className="dark:text-gray-100 dark:focus:bg-gray-700">Loyalty Reward</SelectItem>
                </SelectContent>
              </Select>
              {form.type === "referral" && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Applies automatically: the referred friend's first booking here, and the
                  referrer's next booking once their friend's visit completes.
                </p>
              )}
            </div>
            {form.type === "loyalty" && (
              <div>
                <Label className="dark:text-gray-100">Applies on visit #</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="5"
                  value={form.visitThreshold}
                  onChange={(e) => setForm((f) => ({ ...f, visitThreshold: e.target.value }))}
                  className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Applies once, automatically, on the client's Nth booking here - e.g. "5" for
                  a discount on their 5th visit.
                </p>
              </div>
            )}
            <div>
              <Label className="dark:text-gray-100">Discount (%)</Label>
              <Input
                type="number"
                placeholder="25"
                value={form.discountPercent}
                onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              />
            </div>
            <div>
              <Label className="dark:text-gray-100">Applies To</Label>
              <Select value={form.serviceId} onValueChange={(v) => setForm((f) => ({ ...f, serviceId: v }))}>
                <SelectTrigger className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
                  <SelectValue placeholder="Any service" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  <SelectItem value="any" className="dark:text-gray-100 dark:focus:bg-gray-700">Any service</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="dark:text-gray-100 dark:focus:bg-gray-700">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="dark:text-gray-100">Start Date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
              <div>
                <Label className="dark:text-gray-100">End Date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
            </div>
            {formError && <p className="text-sm text-red-500 dark:text-red-400">{formError}</p>}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-amber-400 dark:to-amber-500 text-[#2d2d2d] dark:text-gray-900 hover:opacity-90 flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {editingId ? "Save Changes" : "Create Campaign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
