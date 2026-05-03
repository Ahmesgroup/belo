// ============================================================
// scripts/reset-dev-state.mjs
// DEV ONLY — clears OTP audit entries so you can test the full
// login flow repeatedly without hitting rate limits.
//
// Usage:
//   node scripts/reset-dev-state.mjs
//
// Safe: never touches bookings, users, tenants, or services.
// OTPs are stored in AuditLog (no separate OTP table in schema).
// ============================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv === "production") {
    console.error("❌ This script must not run in production.");
    process.exit(1);
  }

  console.log("🧹 Reset dev OTP state...");

  // Remove OTP audit entries only (action = "otp.sent")
  // Leaves all other audit logs (bookings, admin actions, etc.) intact
  const deleted = await prisma.auditLog.deleteMany({
    where: { action: { in: ["otp.sent"] } },
  });

  console.log(`✅ Dev OTP state cleared — ${deleted.count} otp.sent entries removed`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
