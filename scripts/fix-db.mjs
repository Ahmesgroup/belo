import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { phone: "+221661000001" },
    update: { role: "SUPER_ADMIN", name: "Pape Diouf" },
    create: { phone: "+221661000001", role: "SUPER_ADMIN", name: "Pape Diouf" },
  });
  console.log("✓ 661000001 → SUPER_ADMIN (Pape Diouf)");

  const studio = await prisma.tenant.findFirst({ where: { slug: "studio-elegance-dakar" } });
  if (studio) {
    await prisma.user.upsert({
      where: { phone: "+221700000001" },
      update: { role: "STAFF", name: "Fatou Employée", tenantId: studio.id },
      create: { phone: "+221700000001", role: "STAFF", name: "Fatou Employée", tenantId: studio.id },
    });
    console.log("✓ 700000001 → STAFF Fatou Employée (Studio Elegance)");

    await prisma.user.upsert({
      where: { phone: "+221700000002" },
      update: { role: "STAFF", name: "Aminata Coiffeuse", tenantId: studio.id },
      create: { phone: "+221700000002", role: "STAFF", name: "Aminata Coiffeuse", tenantId: studio.id },
    });
    console.log("✓ 700000002 → STAFF Aminata Coiffeuse (Studio Elegance)");
  } else {
    console.log("⚠ Studio Elegance not found — seed the DB first");
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
