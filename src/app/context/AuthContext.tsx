import { createContext, useContext, useState, ReactNode } from "react";
import type { AuthTokens, UserRole } from "../lib/authConfig";

const STORAGE_KEY = "ripplebox_auth";

interface DecodedClaims {
  sub: string;
  email: string;
  role: UserRole;
  exp: number;
}

// Client-side decode only, for reading claims to drive UI (e.g. which
// layout/route to send someone to). Not a trust boundary - the API Gateway
// JWT authorizer is what actually verifies the token on every backend call.
function decodeIdToken(idToken: string): DecodedClaims {
  const payload = idToken.split(".")[1];
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  const claims = JSON.parse(json);
  return {
    sub: claims.sub,
    email: claims.email,
    role: (claims["custom:role"] as UserRole) ?? "client",
    exp: claims.exp,
  };
}

interface StoredAuth {
  tokens: AuthTokens;
  claims: DecodedClaims;
}

function loadStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw) as StoredAuth;
    if (stored.claims.exp * 1000 < Date.now()) {
      // Expired and we don't yet implement refresh-token exchange - treat as
      // logged out rather than silently sending an expired token to the API.
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

interface AuthContextType {
  isAuthenticated: boolean;
  idToken: string | null;
  accessToken: string | null;
  userId: string | null;
  email: string | null;
  role: UserRole | null;
  login: (tokens: AuthTokens) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadStoredAuth());

  const login = (tokens: AuthTokens) => {
    const claims = decodeIdToken(tokens.idToken);
    const stored: StoredAuth = { tokens, claims };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setAuth(stored);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: auth !== null,
        idToken: auth?.tokens.idToken ?? null,
        accessToken: auth?.tokens.accessToken ?? null,
        userId: auth?.claims.sub ?? null,
        email: auth?.claims.email ?? null,
        role: auth?.claims.role ?? null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
