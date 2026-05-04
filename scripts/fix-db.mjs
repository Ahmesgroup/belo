// scripts/fix-db.mjs
// Usage: node scripts/fix-db.mjs
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local — use DIRECT_URL to bypass pgBouncer for migrations
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
    console.log("✓ DIRECT_URL used (bypass pgBouncer)");
  }
  console.log("✓ .env.local loaded");
} catch {
  console.warn("⚠️  .env.local not found — DATABASE_URL must be set in environment");
}

const prisma = new PrismaClient();

async function main() {
  console.log("\n🔧 Fix DB Belo\n");

  // 1. Migrate wrong +352 (Luxembourg) prefix to +221 (Senegal)
  const fixed = await prisma.user.updateMany({
    where: { phone: "+352661000001" },
    data:  { phone: "+221661000001", role: "SUPER_ADMIN", name: "Pape Diouf" },
  });
  if (fixed.count > 0) {
    console.log(`✓ Prefix +352 → +221 migrated (${fixed.count} row)`);
  }

  // 2. Upsert super admin with correct prefix (idempotent)
  await prisma.user.upsert({
    where:  { phone: "+221661000001" },
    update: { role: "SUPER_ADMIN", name: "Pape Diouf" },
    create: { phone: "+221661000001", name: "Pape Diouf", role: "SUPER_ADMIN" },
  });
  console.log("✓ 661000001 → SUPER_ADMIN (Pape Diouf)");

  // 3. Purge OTP logs and rate-limit markers so no number is locked out
  const purge = await prisma.auditLog.deleteMany({
    where: { action: { in: ["rate.hit", "otp.sent"] } },
  });
  console.log(`✓ OTP logs + rate limits purged: ${purge.count} entries`);

  // 4. Unblock users if the schema has a blockedUntil field
  try {
    await prisma.user.updateMany({
      where: { blockedUntil: { not: null } },
      data:  { blockedUntil: null },
    });
    console.log("✓ Blocked users released");
  } catch {
    // blockedUntil not in schema — safe to skip
  }

  // 5. Ensure staff for Studio Elegance
  const studio = await prisma.tenant.findFirst({
    where: { slug: "studio-elegance-dakar" },
  });
  if (studio) {
    for (const [phone, name] of [
      ["+221700000001", "Fatou Employée"],
      ["+221700000002", "Aminata Coiffeuse"],
    ]) {
      await prisma.user.upsert({
        where:  { phone },
        update: { role: "STAFF", name, tenantId: studio.id },
        create: { phone, name, role: "STAFF", tenantId: studio.id },
      });
    }
    console.log("✓ Studio Elegance staff ensured");
  }

  // 6. Final report
  console.log("\n📋 Admin accounts in DB:");
  const admins = await prisma.user.findMany({
    where:  { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    select: { phone: true, name: true, role: true },
    orderBy: { role: "asc" },
  });
  admins.forEach(u =>
    console.log(`   ${u.role.padEnd(12)} ${u.phone}  ${u.name}`)
  );

  console.log("\n✅ DB fix complete!");
  console.log("👉 Login with 661000001 → OTP → should arrive on /admin\n");
}

main()
  .catch(e => { console.error("❌", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());

