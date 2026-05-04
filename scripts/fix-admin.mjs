import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";

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
    console.log("DIRECT_URL ok");
  }
} catch {}

const prisma = new PrismaClient();

const del = await prisma.user.deleteMany({
  where: { phone: "+221661000001", role: "CLIENT" }
});
console.log("Deleted CLIENT:", del.count);

const old = await prisma.user.updateMany({
  where: { phone: "+352661000001" },
  data: { phone: "+221661000001", role: "SUPER_ADMIN", name: "Pape Diouf" }
});
console.log("Fixed +352:", old.count);

await prisma.user.upsert({
  where: { phone: "+221661000001" },
  update: { role: "SUPER_ADMIN", name: "Pape Diouf" },
  create: { phone: "+221661000001", name: "Pape Diouf", role: "SUPER_ADMIN" }
});
console.log("Upsert SUPER_ADMIN: ok");

const purge = await prisma.auditLog.deleteMany({
  where: { action: { in: ["rate.hit", "otp.sent"] } }
});
console.log("Purge:", purge.count, "entries");

const check = await prisma.user.findUnique({
  where: { phone: "+221661000001" },
  select: { phone: true, name: true, role: true }
});
console.log("FINAL:", JSON.stringify(check));

await prisma.$disconnect();
