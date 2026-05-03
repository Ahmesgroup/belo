// ============================================================
// lib/auth-client.ts
// Single source of truth for frontend authentication state.
// All localStorage access MUST go through these helpers.
// SSR-safe: checks typeof window before accessing localStorage.
// ============================================================

export interface BeloUser {
  id:       string;
  name:     string;
  phone?:   string;
  role:     string;
  tenantId: string | null;
}

function store(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

/** Current JWT access token, or null if not logged in. */
export function getToken(): string | null {
  return store()?.getItem("belo_token") ?? null;
}

/** Parsed user profile, or null if not logged in or parse fails. */
export function getUser(): BeloUser | null {
  try {
    const raw = store()?.getItem("belo_user");
    if (!raw) return null;
    return JSON.parse(raw) as BeloUser;
  } catch {
    return null;
  }
}

/** Persist token + user after successful login. */
export function setAuth(token: string, user: BeloUser): void {
  const s = store();
  if (!s) return;
  s.setItem("belo_token", token);
  s.setItem("belo_user", JSON.stringify(user));
}

/** Update only the stored user profile (e.g. after role change detected by server). */
export function setStoredUser(user: BeloUser): void {
  store()?.setItem("belo_user", JSON.stringify(user));
}

/** Remove all auth data from storage (logout). */
export function clearAuth(): void {
  const s = store();
  if (!s) return;
  s.removeItem("belo_token");
  s.removeItem("belo_user");
}

/** Whether there is an active token in storage. */
export function isLoggedIn(): boolean {
  return getToken() !== null;
}

/** Whether the current user is a salon owner or staff member. */
export function isOwner(): boolean {
  const role = getUser()?.role;
  return role === "OWNER" || role === "STAFF";
}

/** Whether the current user has platform admin access. */
export function isAdmin(): boolean {
  const role = getUser()?.role;
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/**
 * Authorization header for fetch() calls.
 * Returns empty object when not logged in (caller decides how to handle 401).
 */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) {
    console.warn("[belo] No auth token found");
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

/**
 * Authorization + Content-Type headers for JSON POST/PATCH calls.
 */
export function jsonAuthHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...authHeaders() };
}
