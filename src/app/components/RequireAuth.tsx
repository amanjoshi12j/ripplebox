import { Navigate, Outlet } from "react-router";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../lib/authConfig";

const HOME_PATH: Record<UserRole, string> = {
  admin: "/admin",
  salon_owner: "/salon",
  client: "/client",
};

export function RequireAuth({ role }: { role: UserRole }) {
  const { isAuthenticated, role: currentRole } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={role === "admin" ? "/admin/login" : "/login"} replace />;
  }

  // Signed in as the wrong persona (e.g. a salon_owner hitting /client/*) -
  // send them to their own home instead of the other role's screens.
  if (currentRole !== role) {
    return <Navigate to={HOME_PATH[currentRole ?? "client"]} replace />;
  }

  return <Outlet />;
}
