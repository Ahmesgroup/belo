// scripts/fix-latlng.mjs
// Backfill lat/lng for all tenants that are missing coordinates.
// Usage: node scripts/fix-latlng.mjs [--dry-run]
//
// Strategy (in order):
//   1. Nominatim geocoding of full address + city
//   2. City-level fallback coordinates
//   3. Skip with a warning (no coords assigned)

import { PrismaClient } from "@prisma/client";
import { readFileSync }  from "fs";
import { resolve }       from "path";

// ── Load .env.local ───────────────────────────────────────────
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
    console.log("✓ Using DIRECT_URL (bypass pgBouncer)");
  }
} catch { console.warn("⚠️  .env.local not found"); }

// ── City fallback map ─────────────────────────────────────────
const CITY_COORDS = {
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
  brussels:   { lat:  50.8503, lng:   4.3517 },
  luxembourg: { lat:  49.6117, lng:   6.1319 },
  london:     { lat:  51.5074, lng:  -0.1278 },
};

function cityToCoords(city) {
  if (!city) return null;
  const slug = city.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
  // Exact match
  if (CITY_COORDS[slug]) return CITY_COORDS[slug];
  // Partial match
  for (const [key, val] of Object.entries(CITY_COORDS)) {
    if (slug.includes(key) || key.includes(slug.slice(0, 4))) return val;
  }
  return null;
}

// ── Nominatim geocoding ───────────────────────────────────────
async function nominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Belo-Marketplace/1.0 contact@belo.sn" },
    signal:  AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// ── Main ──────────────────────────────────────────────────────
const isDry = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

async function main() {
  console.log(`\n📍 Fix lat/lng${isDry ? " [DRY RUN]" : ""}\n`);

  const tenants = await prisma.tenant.findMany({
    where:  { OR: [{ lat: null }, { lng: null }] },
    select: { id: true, name: true, city: true, address: true },
    orderBy:{ name: "asc" },
  });

  console.log(`Found ${tenants.length} tenants without coordinates.\n`);
  if (tenants.length === 0) { console.log("✅ All tenants already have coordinates!"); return; }

  let updated = 0, fallback = 0, skipped = 0;

  for (const t of tenants) {
    let coords = null;
    let source = "";

    // 1. Nominatim (rate-limit: 1 req/s)
    if (t.address || t.city) {
      const query = [t.address, t.city].filter(Boolean).join(", ");
      try {
        coords = await nominatim(query);
        if (coords) source = "nominatim";
        await new Promise(r => setTimeout(r, 1100)); // respect 1 req/s
      } catch { /* ignore */ }
    }

    // 2. City fallback
    if (!coords && t.city) {
      coords = cityToCoords(t.city);
      if (coords) source = "city_fallback";
    }

    if (!coords) {
      console.warn(`  ⚠️  SKIP ${t.name} (${t.city ?? "no city"}) — no coords found`);
      skipped++;
      continue;
    }

    console.log(`  ${isDry ? "~" : "✓"} ${t.name.padEnd(30)} lat=${coords.lat.toFixed(4)}, lng=${coords.lng.toFixed(4)}  [${source}]`);

    if (!isDry) {
      await prisma.tenant.update({
        where: { id: t.id },
        data:  { lat: coords.lat, lng: coords.lng },
      });
    }

    if (source === "city_fallback") fallback++; else updated++;
  }

  console.log(`\n📊 Results:`);
  console.log(`  ✓ Geocoded via Nominatim : ${updated}`);
  console.log(`  ~ City fallback used     : ${fallback}`);
  console.log(`  ✗ Skipped (no match)     : ${skipped}`);
  if (isDry) console.log("\n(DRY RUN — nothing saved to DB)");
  else console.log("\n✅ Done! Run /api/cron/metrics to recalculate ranking scores.");
}

main()
  .catch(e => { console.error("❌", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
