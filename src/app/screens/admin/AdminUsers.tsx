import { useEffect, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { useAuth } from "../../context/AuthContext";
import { getAdminUsers, type AdminUserSummary } from "../../lib/apiClient";

export function AdminUsers() {
  const auth = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!auth.idToken) return;
    const timer = setTimeout(() => {
      getAdminUsers(auth.idToken!, query || undefined)
        .then(setUsers)
        .catch(() => setLoadError(true));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, auth.idToken]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pb-6">
      <div className="bg-gradient-to-br from-[#dce8f5] to-[#eef3f7] dark:from-gray-800 dark:to-gray-900 px-6 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-2xl mb-1 text-[#2d2d2d] dark:text-gray-100">Users</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Every client &amp; salon owner account</p>
      </div>

      <div className="px-6 -mt-3">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11 h-12 rounded-xl bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 border-0 shadow-sm"
          />
        </div>
      </div>

      <div className="px-6 mt-4 space-y-2">
        {loadError ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">Couldn't load users right now.</p>
        ) : users === null ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[#6b8cae] dark:text-cyan-400" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">No users match that search.</p>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700 shadow-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[#2d2d2d] dark:text-gray-100 truncate">{user.name}</p>
                  <Badge
                    className={`text-[10px] shrink-0 ${
                      user.role === "salon_owner"
                        ? "bg-[#f5e6c3] dark:bg-amber-900/30 text-[#8a6d1a] dark:text-amber-400"
                        : "bg-[#e6d7f5] dark:bg-purple-900/30 text-[#6b4a91] dark:text-purple-400"
                    }`}
                  >
                    {user.role === "salon_owner" ? "Salon Owner" : "Client"}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user.email}
                  {user.salonName ? ` · ${user.salonName}` : ""}
                </p>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 ml-3">
                Joined {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
