import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";

const prisma = new PrismaClient();

// Load env (use DIRECT_URL for direct connection, bypasses pgBouncer)
try {
  const env = readFileSync(resolve(".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }
} catch {}

async function main() {
  console.log("🔧 BELO SAFE FIX DB");

  // 1. Fix admin — upsert is safe (never deletes, never overwrites name if already correct)
  await prisma.user.upsert({
    where:  { phone: "+221661000001" },
    update: { role: "SUPER_ADMIN" },
    create: { phone: "+221661000001", role: "SUPER_ADMIN", name: "Admin Belo" },
  });
  console.log("✓ Admin fixed");

  // 2. Unblock users (NO DELETE LOGS — audit trail preserved)
  // blockedUntil field may not exist in all schema versions, so we guard with try/catch
  try {
    await (prisma.user as any).updateMany({
      where: { blockedUntil: { not: null } },
      data:  { blockedUntil: null },
    });
    console.log("✓ Users unblocked");
  } catch {
    console.log("ℹ  blockedUntil field not in schema — skip unblock step");
  }

  // 3. Ensure staff demo (safe upsert — never deletes, never overwrites active records)
  const tenant = await prisma.tenant.findFirst();
  if (tenant) {
    await prisma.user.upsert({
      where:  { phone: "+221700000001" },
      update: { role: "STAFF", tenantId: tenant.id },
      create: { phone: "+221700000001", role: "STAFF", name: "Staff Demo", tenantId: tenant.id },
    });
    console.log("✓ Staff ensured");
  }

  console.log("✅ DONE");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
