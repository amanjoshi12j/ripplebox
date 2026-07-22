import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Plus, Edit2, Trash2, Package, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import {
  getSalonProductsManage,
  createSalonProduct,
  updateSalonProduct,
  deleteSalonProduct,
  type ManagedProduct,
} from "../../lib/apiClient";

interface ProductForm {
  name: string;
  price: string;
  description: string;
}

const emptyForm: ProductForm = { name: "", price: "", description: "" };

export function ProductsManagement() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [products, setProducts] = useState<ManagedProduct[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadProducts = () => {
    if (!auth.idToken) return;
    return getSalonProductsManage(auth.idToken).then(setProducts);
  };

  useEffect(() => {
    loadProducts()?.catch(() => setLoadError(true));
  }, [auth.idToken]);

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: ManagedProduct) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      price: String(parseFloat(product.price)),
      description: product.description ?? "",
    });
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!auth.idToken) return;
    setFormError(null);

    const price = parseFloat(form.price);
    if (!form.name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setFormError("Price must be a non-negative number.");
      return;
    }

    setIsSaving(true);
    try {
      const input = { name: form.name.trim(), price, description: form.description.trim() || null };

      if (editingId) {
        await updateSalonProduct(auth.idToken, editingId, input);
        toast.success("Product updated");
      } else {
        await createSalonProduct(auth.idToken, input);
        toast.success("Product added");
      }
      setIsDialogOpen(false);
      await loadProducts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong saving this product.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (product: ManagedProduct) => {
    if (!auth.idToken) return;
    try {
      await deleteSalonProduct(auth.idToken, product.id);
      toast.success("Product removed");
      await loadProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove this product.");
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
          <h1 className="text-2xl text-[#2d2d2d] dark:text-gray-100">Products</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm pl-14">
          Manage the retail products you sell, like shampoo or styling products
        </p>
      </div>

      <div className="px-6 mt-6">
        <Button
          onClick={openCreateDialog}
          className="w-full h-12 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-amber-400 dark:to-amber-500 text-[#2d2d2d] dark:text-gray-900 hover:opacity-90 rounded-xl mb-6"
        >
          <Plus size={20} className="mr-2" />
          Add Product
        </Button>

        {loadError ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">
            Couldn't load products right now. Please try again later.
          </p>
        ) : products === null ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[#d4af37] dark:text-amber-400" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No products yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Add products your salon sells to show them on your profile
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-700 dark:to-gray-600 flex items-center justify-center flex-shrink-0">
                    <Package size={20} className="text-[#e6d7f5] dark:text-amber-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm mb-1 text-[#2d2d2d] dark:text-gray-100">{product.name}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      ${parseFloat(product.price).toFixed(2)}
                    </p>
                    {product.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{product.description}</p>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(product)}
                        className="border-[#e6d7f5] dark:border-amber-400 text-[#e6d7f5] dark:text-amber-400 hover:bg-[#f5f0fc] dark:hover:bg-gray-700 rounded-lg"
                      >
                        <Edit2 size={14} className="mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(product)}
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
              {editingId ? "Edit Product" : "Add Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="dark:text-gray-100">Product Name</Label>
              <Input
                placeholder="e.g., Argan Oil Shampoo"
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
                placeholder="25.00"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="mt-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              />
            </div>
            <div>
              <Label className="dark:text-gray-100">Description (optional)</Label>
              <Input
                placeholder="e.g., 250ml, for dry hair"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
              {editingId ? "Save Changes" : "Save Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
