import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Search, Star, Heart, Sparkles, Loader2, Navigation } from "lucide-react";
import { Input } from "../../components/ui/input";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { Badge } from "../../components/ui/badge";
import { useAuth } from "../../context/AuthContext";
import { getSalons, getMyFavorites, addFavorite, removeFavorite, type SalonSummary } from "../../lib/apiClient";
import { getCurrentPosition, distanceKm, formatDistanceKm } from "../../lib/geo";

type FilterType = "all" | "topRated" | "favorites" | "nearby";

export function SalonsScreen() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [salons, setSalons] = useState<SalonSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [myPosition, setMyPosition] = useState<{ lat: number; lon: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    if (!auth.idToken) return;
    Promise.all([getSalons(), getMyFavorites(auth.idToken)])
      .then(([salonList, favoriteIds]) => {
        setSalons(salonList);
        setFavorites(favoriteIds);
      })
      .catch(() => setLoadError(true));
  }, [auth.idToken]);

  const distanceToSalon = (salon: SalonSummary): number | null => {
    if (!myPosition || salon.latitude === null || salon.longitude === null) return null;
    return distanceKm(myPosition.lat, myPosition.lon, parseFloat(salon.latitude), parseFloat(salon.longitude));
  };

  const handleNearbyFilter = async () => {
    if (myPosition) {
      setSelectedFilter("nearby");
      return;
    }
    try {
      const position = await getCurrentPosition();
      setMyPosition({ lat: position.coords.latitude, lon: position.coords.longitude });
      setLocationDenied(false);
      setSelectedFilter("nearby");
    } catch {
      setLocationDenied(true);
    }
  };

  const toggleFavorite = (salonId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.idToken) return;
    const isFavorite = favorites.includes(salonId);
    // Optimistic update - a failed favorite toggle isn't worth blocking the
    // UI on, just log it and let the next load reconcile.
    setFavorites((prev) => (isFavorite ? prev.filter((id) => id !== salonId) : [...prev, salonId]));
    const request = isFavorite ? removeFavorite(auth.idToken, salonId) : addFavorite(auth.idToken, salonId);
    request.catch((err) => console.error("Failed to update favorite:", err));
  };

  const getFilteredSalons = () => {
    let filtered = salons ?? [];

    // Apply filter
    switch (selectedFilter) {
      case "topRated":
        filtered = filtered.filter((salon) => salon.rating !== null && parseFloat(salon.rating) >= 4.8);
        break;
      case "favorites":
        filtered = filtered.filter((salon) => favorites.includes(salon.id));
        break;
      case "nearby":
        // Salons without a saved location sort to the end rather than being
        // hidden - the owner just hasn't tapped "Save My Location" yet.
        filtered = [...filtered].sort((a, b) => {
          const da = distanceToSalon(a);
          const db = distanceToSalon(b);
          if (da === null && db === null) return 0;
          if (da === null) return 1;
          if (db === null) return -1;
          return da - db;
        });
        break;
      case "all":
      default:
        break;
    }

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter((salon) =>
        salon.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredSalons = getFilteredSalons();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#fef3f7] to-[#f5f0fc] dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-2xl mb-2 text-[#2d2d2d] dark:text-gray-100">Sydney Salons</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Discover beauty destinations across Sydney</p>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
          <Input
            type="text"
            placeholder="Search salons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-xl bg-white dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 border-0 shadow-sm"
          />
        </div>
      </div>

      <div className="px-6 mt-6">
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 hide-scrollbar">
          <Badge
            onClick={() => setSelectedFilter("all")}
            variant="secondary"
            className={`cursor-pointer whitespace-nowrap ${
              selectedFilter === "all"
                ? "bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            All Salons
          </Badge>
          <Badge
            onClick={() => setSelectedFilter("topRated")}
            variant="outline"
            className={`cursor-pointer whitespace-nowrap ${
              selectedFilter === "topRated"
                ? "bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white border-transparent"
                : "dark:border-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            Top Rated
          </Badge>
          <Badge
            onClick={() => setSelectedFilter("favorites")}
            variant="outline"
            className={`cursor-pointer whitespace-nowrap ${
              selectedFilter === "favorites"
                ? "bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white border-transparent"
                : "dark:border-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            Favorites
          </Badge>
          <Badge
            onClick={handleNearbyFilter}
            variant="outline"
            className={`cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              selectedFilter === "nearby"
                ? "bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 text-[#2d2d2d] dark:text-white border-transparent"
                : "dark:border-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <Navigation size={12} />
            Nearby
          </Badge>
        </div>

        {locationDenied && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            Enable location access for this site to sort salons by distance.
          </p>
        )}

        {/* Salons list */}
        <div className="space-y-4">
          {loadError ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">
              Couldn't load salons right now. Please try again later.
            </p>
          ) : salons === null ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-[#e6d7f5] dark:text-purple-400" />
            </div>
          ) : filteredSalons.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Sparkles size={40} className="text-gray-400 dark:text-gray-600" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">No salons found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                {selectedFilter === "favorites"
                  ? "You haven't added any favorites yet"
                  : selectedFilter === "nearby" && !myPosition
                    ? "Enable location access to sort salons by distance"
                    : "Try adjusting your search or filters"}
              </p>
            </div>
          ) : (
            filteredSalons.map((salon) => (
            <div
              key={salon.id}
              onClick={() => navigate(`/client/salons/${salon.id}`)}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            >
              {/* Image */}
              <div className="relative h-40">
                <ImageWithFallback
                  src={salon.image ?? ""}
                  alt={salon.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => toggleFavorite(salon.id, e)}
                  className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm flex items-center justify-center hover:bg-white dark:hover:bg-gray-800 transition-colors"
                >
                  <Heart
                    size={20}
                    className={
                      favorites.includes(salon.id)
                        ? "fill-[#f5d7e3] dark:fill-pink-400 text-[#f5d7e3] dark:text-pink-400"
                        : "text-gray-400 dark:text-gray-500"
                    }
                  />
                </button>
                {parseFloat(salon.rewardMultiplier) > 1 && (
                  <div className="absolute top-3 left-3 bg-gradient-to-r from-[#d4af37] to-[#f5e6c3] dark:from-amber-500 dark:to-yellow-500 text-white px-3 py-1 rounded-full text-xs">
                    {parseFloat(salon.rewardMultiplier)}x Rewards
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="text-lg mb-2 text-[#2d2d2d] dark:text-gray-100">{salon.name}</h3>

                {salon.rating !== null && (
                  <div className="flex items-center gap-1 mb-3">
                    <Star size={16} className="fill-[#d4af37] dark:fill-amber-400 text-[#d4af37] dark:text-amber-400" />
                    <span className="text-sm text-[#2d2d2d] dark:text-gray-100">{salon.rating}</span>
                    <span className="text-sm text-gray-400 dark:text-gray-500">({salon.reviewCount})</span>
                  </div>
                )}

                <div className="mb-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{salon.address}</p>
                  {distanceToSalon(salon) !== null && (
                    <p className="text-xs text-[#c9a3e8] dark:text-purple-400 flex items-center gap-1 mt-0.5">
                      <Navigation size={12} />
                      {formatDistanceKm(distanceToSalon(salon)!)}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {salon.services.slice(0, 3).map((service) => (
                    <Badge
                      key={service.id}
                      variant="secondary"
                      className="bg-[#f5f0fc] dark:bg-purple-900/30 text-[#2d2d2d] dark:text-gray-100 text-xs"
                    >
                      {service.name}
                    </Badge>
                  ))}
                  {salon.services.length > 3 && (
                    <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs">
                      +{salon.services.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )))}
        </div>
      </div>
    </div>
  );
}
