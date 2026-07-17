import { Navigate, Outlet } from "react-router";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../lib/authConfig";

export function RequireAuth({ role }: { role: UserRole }) {
  const { isAuthenticated, role: currentRole } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Signed in as the wrong persona (e.g. a salon_owner hitting /client/*) -
  // send them to their own home instead of the other role's screens.
  if (currentRole !== role) {
    return <Navigate to={currentRole === "salon_owner" ? "/salon" : "/client"} replace />;
  }

  return <Outlet />;
}
