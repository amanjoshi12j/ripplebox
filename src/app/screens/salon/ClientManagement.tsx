import { useEffect, useState } from "react";
import { Search, Mail, Phone, Plus, Loader2 } from "lucide-react";
import { Input } from "../../components/ui/input";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import {
  getSalonClients,
  getSalonServicesManage,
  logVisit,
  type SalonClient,
  type ManagedService,
} from "../../lib/apiClient";

type FilterType = "all" | "topSpenders" | "recent";

export function ClientManagement() {
  const auth = useAuth();
  const [clients, setClients] = useState<SalonClient[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [services, setServices] = useState<ManagedService[]>([]);

  const [isLogVisitOpen, setIsLogVisitOpen] = useState(false);
  const [visitEmail, setVisitEmail] = useState("");
  const [visitAmount, setVisitAmount] = useState("");
  const [visitServiceId, setVisitServiceId] = useState("");
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false);
  const [visitError, setVisitError] = useState<string | null>(null);

  const loadClients = () => {
    if (!auth.idToken) return;
    return getSalonClients(auth.idToken).then(setClients);
  };

  useEffect(() => {
    loadClients()?.catch(() => setLoadError(true));
  }, [auth.idToken]);

  useEffect(() => {
    if (!auth.idToken) return;
    getSalonServicesManage(auth.idToken)
      .then(setServices)
      .catch(() => {
        // Non-fatal - Log Visit just falls back to the dollar-only flow
        // below if this salon has no services defined yet.
      });
  }, [auth.idToken]);

  const handleServiceSelect = (serviceId: string) => {
    setVisitServiceId(serviceId);
    // Prefill the amount from the service's price as a convenience - still
    // editable in case of a tip, discount, or add-on.
    const service = services.find((s) => s.id === serviceId);
    if (service && !visitAmount) {
      setVisitAmount(String(parseFloat(service.price)));
    }
  };

  const handleLogVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.idToken) return;
    setVisitError(null);

    if (services.length > 0 && !visitServiceId) {
      setVisitError("Please choose which service this visit was for.");
      return;
    }

    setIsSubmittingVisit(true);
    try {
      const amount = parseFloat(visitAmount);
      const result = await logVisit(auth.idToken, visitEmail, amount, visitServiceId || undefined);
      toast.success(`Logged visit - awarded ${result.pointsEarned} points`);
      setIsLogVisitOpen(false);
      setVisitEmail("");
      setVisitAmount("");
      setVisitServiceId("");
      await loadClients();
    } catch (err) {
      setVisitError(err instanceof Error ? err.message : "Something went wrong logging this visit.");
    } finally {
      setIsSubmittingVisit(false);
    }
  };

  const getFilteredClients = () => {
    let filtered = clients ?? [];

    switch (selectedFilter) {
      case "topSpenders":
        filtered = [...filtered].sort((a, b) => parseFloat(b.totalSpent) - parseFloat(a.totalSpent));
        break;
      case "recent":
        filtered = [...filtered].sort((a, b) => {
          if (!a.lastVisit) return 1;
          if (!b.lastVisit) return -1;
          return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime();
        });
        break;
      case "all":
      default:
        break;
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (client) =>
          client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          client.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredClients = getFilteredClients();
  const totalClients = clients?.length ?? 0;
  const totalVisits = clients?.reduce((sum, c) => sum + c.visits, 0) ?? 0;
  const totalPointsIssued = clients?.reduce((sum, c) => sum + c.loyaltyPoints, 0) ?? 0;

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/30 dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl text-[#2d2d2d] dark:text-gray-100">Client Management</h1>
          <Button
            onClick={() => setIsLogVisitOpen(true)}
            size="sm"
            className="bg-gradient-to-r from-[#d4af37] to-[#f5e6c3] dark:from-amber-500 dark:to-yellow-500 text-white hover:opacity-90 rounded-xl flex items-center gap-1"
          >
            <Plus size={16} />
            Log Visit
          </Button>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Manage your client relationships</p>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
          <Input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-xl bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400 border-0 shadow-sm"
          />
        </div>
      </div>

      <div className="px-6 mt-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gradient-to-br from-[#e6d7f5] to-[#f5f0fc] dark:from-gray-800 dark:to-gray-700 rounded-2xl p-4 text-center">
            <h3 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{totalClients}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">Total Clients</p>
          </div>
          <div className="bg-gradient-to-br from-[#f5d7e3] to-[#fef3f7] dark:from-gray-800 dark:to-gray-700 rounded-2xl p-4 text-center">
            <h3 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{totalVisits}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">Total Visits</p>
          </div>
          <div className="bg-gradient-to-br from-[#f5e6c3] to-[#d4af37]/20 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-4 text-center">
            <h3 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">{totalPointsIssued}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">Points Issued</p>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 hide-scrollbar">
          <Badge
            onClick={() => setSelectedFilter("all")}
            className={`cursor-pointer whitespace-nowrap ${
              selectedFilter === "all"
                ? "bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-amber-400 dark:to-amber-500 text-[#2d2d2d] dark:text-gray-900"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            }`}
          >
            All Clients
          </Badge>
          <Badge
            onClick={() => setSelectedFilter("topSpenders")}
            variant="outline"
            className={`cursor-pointer whitespace-nowrap ${
              selectedFilter === "topSpenders"
                ? "bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-amber-400 dark:to-amber-500 text-[#2d2d2d] dark:text-gray-900 border-transparent"
                : "dark:border-gray-600 dark:text-gray-300"
            }`}
          >
            Top Spenders
          </Badge>
          <Badge
            onClick={() => setSelectedFilter("recent")}
            variant="outline"
            className={`cursor-pointer whitespace-nowrap ${
              selectedFilter === "recent"
                ? "bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-amber-400 dark:to-amber-500 text-[#2d2d2d] dark:text-gray-900 border-transparent"
                : "dark:border-gray-600 dark:text-gray-300"
            }`}
          >
            Recent
          </Badge>
        </div>

        {/* Client list */}
        {loadError ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">
            Couldn't load clients right now. Please try again later.
          </p>
        ) : clients === null ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[#d4af37] dark:text-amber-400" />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <ImageWithFallback
                    src={client.avatar ?? ""}
                    alt={client.name}
                    className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <h4 className="text-base mb-1 text-[#2d2d2d] dark:text-gray-100">{client.name}</h4>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Mail size={12} />
                        <span>{client.email}</span>
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Phone size={12} />
                          <span>{client.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Visits</p>
                        <p className="text-sm text-[#2d2d2d] dark:text-gray-100">{client.visits}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Spent</p>
                        <p className="text-sm text-[#2d2d2d] dark:text-gray-100">${client.totalSpent}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Points</p>
                        <p className="text-sm text-[#2d2d2d] dark:text-gray-100">{client.loyaltyPoints}</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {client.lastVisit
                          ? `Last visit: ${new Date(client.lastVisit).toLocaleDateString()}`
                          : "No visits yet"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredClients.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No clients found</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  {clients.length === 0 ? "Log a visit to add your first client" : "Try adjusting your search"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Visit dialog */}
      <Dialog open={isLogVisitOpen} onOpenChange={setIsLogVisitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log a Visit</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogVisit} className="space-y-4">
            <div>
              <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Client Email</label>
              <Input
                type="email"
                placeholder="client@example.com"
                value={visitEmail}
                onChange={(e) => setVisitEmail(e.target.value)}
                required
              />
            </div>
            {services.length > 0 && (
              <div>
                <Label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Service</Label>
                <Select value={visitServiceId} onValueChange={handleServiceSelect}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} - {service.pointsValue} pts
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Amount Spent ($)</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="50.00"
                value={visitAmount}
                onChange={(e) => setVisitAmount(e.target.value)}
                required
              />
            </div>
            {visitError && <p className="text-sm text-red-500 dark:text-red-400">{visitError}</p>}
            <DialogFooter>
              <Button
                type="submit"
                disabled={isSubmittingVisit}
                className="bg-gradient-to-r from-[#d4af37] to-[#f5e6c3] dark:from-amber-500 dark:to-yellow-500 text-white hover:opacity-90 rounded-xl flex items-center gap-2"
              >
                {isSubmittingVisit && <Loader2 size={16} className="animate-spin" />}
                Log Visit & Award Points
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
