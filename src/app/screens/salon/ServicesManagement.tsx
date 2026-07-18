import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Plus, Edit2, Trash2, Scissors, Award, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import {
  getSalonServicesManage,
  createSalonService,
  updateSalonService,
  deleteSalonService,
  type ManagedService,
} from "../../lib/apiClient";

interface ServiceForm {
  name: string;
  price: string;
  pointsValue: string;
}

const emptyForm: ServiceForm = { name: "", price: "", pointsValue: "" };

export function ServicesManagement() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [services, setServices] = useState<ManagedService[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadServices = () => {
    if (!auth.idToken) return;
    return getSalonServicesManage(auth.idToken).then(setServices);
  };

  useEffect(() => {
    loadServices()?.catch(() => setLoadError(true));
  }, [auth.idToken]);

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (service: ManagedService) => {
    setEditingId(service.id);
    setForm({
      name: service.name,
      price: String(parseFloat(service.price)),
      pointsValue: String(service.pointsValue),
    });
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!auth.idToken) return;
    setFormError(null);

    const price = parseFloat(form.price);
    const pointsValue = parseInt(form.pointsValue, 10);
    if (!form.name.trim()) {
      setFormError("Service name is required.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setFormError("Price must be a non-negative number.");
      return;
    }
    if (!Number.isInteger(pointsValue) || pointsValue < 0) {
      setFormError("Points must be a non-negative whole number.");
      return;
    }

    setIsSaving(true);
    try {
      const input = { name: form.name.trim(), price, pointsValue };

      if (editingId) {
        await updateSalonService(auth.idToken, editingId, input);
        toast.success("Service updated");
      } else {
        await createSalonService(auth.idToken, input);
        toast.success("Service added");
      }
      setIsDialogOpen(false);
      await loadServices();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong saving this service.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (service: ManagedService) => {
    if (!auth.idToken) return;
    try {
      await deleteSalonService(auth.idToken, service.id);
      toast.success("Service removed");
      await loadServices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove this service.");
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/30 dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-8 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-[#2d2d2d] dark:text-gray-100" />
          </button>
          <h1 className="text-2xl text-[#2d2d2d] dark:text-gray-100">Services</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm pl-14">
          Manage the services you offer, their prices, and points earned
        </p>
      </div>

      <div className="px-6 mt-6">
        <Button
          onClick={openCreateDialog}
          className="w-full h-12 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-amber-400 dark:to-amber-500 text-[#2d2d2d] dark:text-gray-900 hover:opacity-90 rounded-xl mb-6"
        >
          <Plus size={20} className="mr-2" />
          Add Service
        </Button>

        {loadError ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">
            Couldn't load services right now. Please try again later.
          </p>
        ) : services === null ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[#d4af37] dark:text-amber-400" />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No services yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Add your first service to show it on your salon profile
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-700 dark:to-gray-600 flex items-center justify-center flex-shrink-0">
                    <Scissors size={20} className="text-[#e6d7f5] dark:text-amber-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm mb-1 text-[#2d2d2d] dark:text-gray-100">{service.name}</h4>
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        ${parseFloat(service.price).toFixed(2)}
                      </p>
                      <p className="text-sm text-[#d4af37] dark:text-amber-400 flex items-center gap-1">
                        <Award size={14} />
                        {service.pointsValue} pts
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(service)}
                        className="border-[#e6d7f5] dark:border-amber-400 text-[#e6d7f5] dark:text-amber-400 hover:bg-[#f5f0fc] dark:hover:bg-gray-700 rounded-lg"
                      >
                        <Edit2 size={14} className="mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(service)}
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
              {editingId ? "Edit Service" : "Add Service"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="dark:text-gray-100">Service Name</Label>
              <Input
                placeholder="e.g., Haircut & Style"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              />
            </div>
            <div>
              <Label className="dark:text-gray-100">Price ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="50.00"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              />
            </div>
            <div>
              <Label className="dark:text-gray-100">Points Earned</Label>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="20"
                value={form.pointsValue}
                onChange={(e) => setForm((f) => ({ ...f, pointsValue: e.target.value }))}
                className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                How many loyalty points a client earns for this service
              </p>
            </div>
            {formError && <p className="text-sm text-red-500 dark:text-red-400">{formError}</p>}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-amber-400 dark:to-amber-500 text-[#2d2d2d] dark:text-gray-900 hover:opacity-90 flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {editingId ? "Save Changes" : "Save Service"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
