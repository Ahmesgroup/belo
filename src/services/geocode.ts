// ============================================================
// services/geocode.ts — Address → lat/lng via OpenStreetMap Nominatim
//
// Free tier, no API key required. Rate limit: 1 req/second.
// Used at tenant creation to pre-populate lat/lng.
// ============================================================

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

// City fallback coordinates (used when Nominatim is unavailable)
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  dakar:      { lat:  14.7167, lng: -17.4677 },
  thies:      { lat:  14.7833, lng: -16.9333 },
  abidjan:    { lat:   5.3364, lng:  -4.0267 },
  bamako:     { lat:  12.6392, lng:  -8.0029 },
  conakry:    { lat:   9.5370, lng: -13.6773 },
  casablanca: { lat:  33.5731, lng:  -7.5898 },
  rabat:      { lat:  34.0209, lng:  -6.8416 },
  tunis:      { lat:  36.8190, lng:  10.1658 },
  paris:      { lat:  48.8566, lng:   2.3522 },
  lyon:       { lat:  45.7640, lng:   4.8357 },
  bruxelles:  { lat:  50.8503, lng:   4.3517 },
  luxembourg: { lat:  49.6117, lng:   6.1319 },
  london:     { lat:  51.5074, lng:  -0.1278 },
  "new-york": { lat:  40.7128, lng: -74.0060 },
};

export interface GeoResult {
  lat:    number;
  lng:    number;
  source: "nominatim" | "city_fallback" | "default";
}

/**
 * Convert an address string to lat/lng.
 * Falls back to city-level coordinates, then to Dakar default.
 */
export async function geocodeAddress(address: string, city?: string): Promise<GeoResult> {
  // 1. Try full address via Nominatim
  try {
    const query  = [address, city].filter(Boolean).join(", ");
    const url    = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res    = await fetch(url, {
      headers:  { "User-Agent": "Belo-Marketplace/1.0 contact@belo.sn" },
      signal:   AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const results = await res.json() as Array<{ lat: string; lon: string }>;
      if (results.length > 0) {
        return {
          lat:    parseFloat(results[0].lat),
          lng:    parseFloat(results[0].lon),
          source: "nominatim",
        };
      }
    }
  } catch {
    // Nominatim unavailable — fall through to city fallback
  }

  // 2. City fallback
  if (city) {
    const slug   = city.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
    const coords = CITY_COORDS[slug];
    if (coords) return { ...coords, source: "city_fallback" };

    // Partial match (e.g. "Dakar, Sénégal" → "dakar")
    for (const [key, val] of Object.entries(CITY_COORDS)) {
      if (slug.includes(key) || key.includes(slug.slice(0, 4))) {
        return { ...val, source: "city_fallback" };
      }
    }
  }

  // 3. Dakar default
  return { ...CITY_COORDS.dakar, source: "default" };
}

/**
 * Returns city fallback coords directly (no network call).
 * Used in bulk scripts where rate-limiting matters.
 */
export function getCityCoords(citySlug: string): { lat: number; lng: number } | null {
  const slug = citySlug.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return CITY_COORDS[slug] ?? null;
}

export { CITY_COORDS };
