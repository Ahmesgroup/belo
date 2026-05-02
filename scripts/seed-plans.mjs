import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.planConfig.createMany({
    skipDuplicates: true,
    data: [
      { plan:"FREE",    priceFcfa:0,     priceEur:0,  priceUsd:0,  priceFcfaAnnual:0,     priceEurAnnual:0,  priceUsdAnnual:0  },
      { plan:"PRO",     priceFcfa:15000, priceEur:23, priceUsd:25, priceFcfaAnnual:12500, priceEurAnnual:19, priceUsdAnnual:21 },
      { plan:"PREMIUM", priceFcfa:35000, priceEur:53, priceUsd:58, priceFcfaAnnual:29167, priceEurAnnual:44, priceUsdAnnual:48 },
    ],
  });
  console.log("✓ PlanConfig seeded");
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
