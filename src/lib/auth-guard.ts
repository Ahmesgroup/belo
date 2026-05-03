import type { BeloUser } from "@/lib/auth-client";

/**
 * Single source of truth for post-login destination.
 *
 * Rules:
 *  SUPER_ADMIN → /admin
 *  ADMIN       → /dashboard
 *  OWNER       → /dashboard
 *  STAFF       → /dashboard
 *  CLIENT      → /profil  (and any unknown role)
 *  null        → /login
 */
export function resolveRedirect(user: BeloUser | null | undefined): string {
  if (!user) return "/login";

  switch (user.role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "ADMIN":
    case "OWNER":
    case "STAFF":
      return "/dashboard";
    case "CLIENT":
    default:
      return "/profil";
  }
}

/**
 * Roles that may access the owner dashboard.
 * CLIENT and unauthenticated users are blocked at the layout level.
 */
export const DASHBOARD_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "STAFF"] as const;

/** Roles that may access the super-admin panel. */
export const ADMIN_ROLES = ["SUPER_ADMIN"] as const;
