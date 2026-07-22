import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  MapPin,
  Star,
  Phone,
  Clock,
  Heart,
  Share2,
  Gift,
  Loader2,
  Navigation,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { useAuth } from "../../context/AuthContext";
import { getSalons, getMe, getMyFavorites, addFavorite, removeFavorite, type SalonSummary } from "../../lib/apiClient";
import { getCurrentPosition, distanceKm, formatDistanceKm, directionsUrl } from "../../lib/geo";

export function SalonProfileScreen() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { id } = useParams<{ id: string }>();
  // undefined = still loading, null = confirmed not found
  const [salon, setSalon] = useState<SalonSummary | null | undefined>(undefined);
  const [points, setPoints] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [myDistanceKm, setMyDistanceKm] = useState<number | null>(null);

  useEffect(() => {
    if (!id || !auth.idToken) return;
    Promise.all([getSalons(), getMe(auth.idToken), getMyFavorites(auth.idToken)])
      .then(([salonList, me, favoriteIds]) => {
        const found = salonList.find((s) => s.id === id) ?? null;
        setSalon(found);
        if (found) {
          setPoints(me.salonPoints.find((p) => p.salonId === found.id)?.points ?? 0);
          setIsFavorite(favoriteIds.includes(found.id));
        }
      })
      .catch(() => setLoadError(true));
  }, [id, auth.idToken]);

  // Best-effort - if the salon has no saved location, or the client denies
  // location access, we just don't show a distance. Not worth an error toast.
  useEffect(() => {
    if (!salon || salon.latitude === null || salon.longitude === null) return;
    getCurrentPosition()
      .then((position) => {
        setMyDistanceKm(
          distanceKm(position.coords.latitude, position.coords.longitude, parseFloat(salon.latitude!), parseFloat(salon.longitude!))
        );
      })
      .catch(() => {});
  }, [salon]);

  const toggleFavorite = () => {
    if (!auth.idToken || !salon) return;
    const nextIsFavorite = !isFavorite;
    setIsFavorite(nextIsFavorite);
    const request = nextIsFavorite ? addFavorite(auth.idToken, salon.id) : removeFavorite(auth.idToken, salon.id);
    request.catch((err) => console.error("Failed to update favorite:", err));
  };

  if (loadError) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <p className="text-gray-500 dark:text-gray-400">Couldn't load this salon right now.</p>
      </div>
    );
  }

  if (salon === undefined) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <Loader2 size={32} className="animate-spin text-[#e6d7f5] dark:text-purple-400" />
      </div>
    );
  }

  if (!salon) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <p className="text-gray-500 dark:text-gray-400">Salon not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pb-20">
      {/* Header image */}
      <div className="relative h-64">
        <ImageWithFallback
          src={salon.image ?? ""}
          alt={salon.name}
          className="w-full h-full object-cover"
        />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm flex items-center justify-center hover:bg-white dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={20} className="text-[#2d2d2d] dark:text-gray-100" />
        </button>

        {/* Action buttons */}
        <div className="absolute top-6 right-6 flex gap-2">
          <button
            onClick={toggleFavorite}
            className="w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm flex items-center justify-center hover:bg-white dark:hover:bg-gray-800 transition-colors"
          >
            <Heart
              size={20}
              className={isFavorite ? "fill-[#f5d7e3] dark:fill-pink-400 text-[#f5d7e3] dark:text-pink-400" : "text-gray-400 dark:text-gray-500"}
            />
          </button>
          <button className="w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm flex items-center justify-center hover:bg-white dark:hover:bg-gray-800 transition-colors">
            <Share2 size={20} className="text-[#2d2d2d] dark:text-gray-100" />
          </button>
        </div>

        {/* Reward badge */}
        {parseFloat(salon.rewardMultiplier) > 1 && (
          <div className="absolute bottom-4 left-6 bg-gradient-to-r from-[#d4af37] to-[#f5e6c3] dark:from-amber-500 dark:to-yellow-500 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
            <Gift size={16} />
            <span>{parseFloat(salon.rewardMultiplier)}x Rewards Active</span>
          </div>
        )}
      </div>

      {/* Salon info */}
      <div className="px-6 py-6">
        <h1 className="text-2xl mb-2 text-[#2d2d2d] dark:text-gray-100">{salon.name}</h1>

        {salon.rating !== null && (
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1">
              <Star size={18} className="fill-[#d4af37] dark:fill-amber-400 text-[#d4af37] dark:text-amber-400" />
              <span className="text-base text-[#2d2d2d] dark:text-gray-100">{salon.rating}</span>
              <span className="text-sm text-gray-400 dark:text-gray-500">({salon.reviewCount} reviews)</span>
            </div>
          </div>
        )}

        {salon.description && <p className="text-gray-600 dark:text-gray-400 mb-6">{salon.description}</p>}

        {/* Contact info */}
        <div className="space-y-3 mb-6">
          {salon.address && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <MapPin size={20} className="text-[#e6d7f5] dark:text-purple-400" />
                <span className="text-sm">
                  {salon.address}
                  {myDistanceKm !== null && (
                    <span className="text-[#c9a3e8] dark:text-purple-400"> · {formatDistanceKm(myDistanceKm)}</span>
                  )}
                </span>
              </div>
              {salon.latitude !== null && salon.longitude !== null && (
                <a
                  href={directionsUrl(parseFloat(salon.latitude), parseFloat(salon.longitude))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-1 text-xs text-[#2d2d2d] dark:text-gray-100 bg-[#f5f0fc] dark:bg-purple-900/30 px-3 py-1.5 rounded-full hover:bg-[#e6d7f5]/50 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <Navigation size={12} />
                  Directions
                </a>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <Phone size={20} className="text-[#e6d7f5] dark:text-purple-400" />
            <span className="text-sm">+61 (02) 9876 5432</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <Clock size={20} className="text-[#e6d7f5] dark:text-purple-400" />
            <span className="text-sm">Mon-Sat: 9:00 AM - 7:00 PM</span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="services" className="w-full">
          <TabsList className="w-full mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <TabsTrigger
              value="services"
              className="flex-1 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm dark:text-gray-400 dark:data-[state=active]:text-gray-100"
            >
              Services
            </TabsTrigger>
            <TabsTrigger
              value="products"
              className="flex-1 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm dark:text-gray-400 dark:data-[state=active]:text-gray-100"
            >
              Products
            </TabsTrigger>
            <TabsTrigger
              value="offers"
              className="flex-1 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm dark:text-gray-400 dark:data-[state=active]:text-gray-100"
            >
              Offers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-3">
            {salon.services.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                No services listed yet.
              </p>
            ) : (
              salon.services.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-transparent dark:border-gray-700"
                >
                  <div>
                    <h4 className="text-sm mb-1 text-[#2d2d2d] dark:text-gray-100">{service.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      ${parseFloat(service.price).toFixed(2)}
                      {service.pointsValue > 0 && (
                        <span className="text-[#d4af37] dark:text-amber-400"> · {service.pointsValue} pts</span>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/client/salons/${salon.id}/book?serviceId=${service.id}`)}
                    className="border-[#e6d7f5] dark:border-purple-500 text-[#e6d7f5] dark:text-purple-400 hover:bg-[#f5f0fc] dark:hover:bg-purple-900/30 rounded-lg"
                  >
                    Book
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="products" className="space-y-3">
            {salon.products.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                No products listed yet.
              </p>
            ) : (
              salon.products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-transparent dark:border-gray-700"
                >
                  <div>
                    <h4 className="text-sm mb-1 text-[#2d2d2d] dark:text-gray-100">{product.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      ${parseFloat(product.price).toFixed(2)}
                    </p>
                    {product.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{product.description}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="offers" className="space-y-4">
            <div className="bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl p-5 border border-transparent dark:border-gray-700">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center">
                  <Gift size={24} className="text-[#e6d7f5] dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-base mb-1 text-[#2d2d2d] dark:text-gray-100">New Client Offer</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">20% off your first visit</p>
                </div>
              </div>
              <Button className="w-full bg-white dark:bg-gray-800 text-[#2d2d2d] dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl">
                Claim Offer
              </Button>
            </div>

            <div className="bg-gradient-to-br from-[#f5d7e3] to-[#fef3f7] dark:from-pink-900/30 dark:to-purple-900/30 rounded-2xl p-5 border border-transparent dark:border-gray-700">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center">
                  <Star size={24} className="text-[#d4af37] dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-base mb-1 text-[#2d2d2d] dark:text-gray-100">Loyalty Bonus</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Earn {parseFloat(salon.rewardMultiplier)}x points on all services
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#2d2d2d]/70 dark:text-gray-300">
                You have <span className="font-medium">{points} points</span> here - redeemable
                only at this salon
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Book button */}
        <Button
          onClick={() => navigate(`/client/salons/${salon.id}/book`)}
          className="w-full h-14 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white hover:opacity-90 rounded-2xl mt-6"
        >
          Book Appointment
        </Button>
      </div>
    </div>
  );
}
