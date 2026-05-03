// ============================================================
// lib/settings.ts — Platform settings with short-lived cache
//
// Reads from SystemSetting table (created by the admin panel).
// A 30-second in-process cache prevents a DB hit on every request
// while still reflecting changes quickly.
// ============================================================

import { prisma } from "@/infrastructure/db/prisma";

interface SettingsCache {
  data:    Record<string, unknown>;
  expiry:  number;
}

let cache: SettingsCache | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

/** Returns all settings as a typed key-value map. */
export async function getAllSettings(): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (cache && now < cache.expiry) return cache.data;

  const rows = await prisma.systemSetting.findMany();
  const data = Object.fromEntries(rows.map(r => [r.key, r.value]));
  cache = { data, expiry: now + CACHE_TTL_MS };
  return data;
}

/** Returns a single setting value with a typed default. */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const settings = await getAllSettings();
  return (key in settings ? (settings[key] as T) : defaultValue);
}

/** Shorthand — is maintenance mode currently ON? */
export async function isMaintenanceMode(): Promise<boolean> {
  return getSetting<boolean>("maintenance_mode", false);
}

/** Shorthand — current commission percentage. */
export async function getCommissionPercent(): Promise<number> {
  return getSetting<number>("commission_percent", 3);
}

/** Invalidates the in-process cache. Call after writing new settings. */
export function invalidateSettingsCache(): void {
  cache = null;
}

/**
 * Checks maintenance mode and throws a 503 AppError if active.
 * Import this at the start of any booking / payment route handler.
 *
 * @example
 *   await requireNotMaintenance();
 */
export async function requireNotMaintenance(): Promise<void> {
  const on = await isMaintenanceMode();
  if (on) {
    const { AppError } = await import("@/shared/errors");
    throw new AppError(
      "MAINTENANCE",
      "La plateforme est en maintenance. Veuillez réessayer dans quelques minutes.",
      503
    );
  }
}
