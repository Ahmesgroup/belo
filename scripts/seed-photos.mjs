import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const PHOTOS = {
  "studio-elegance-dakar": "https://images.pexels.com/photos/3065209/pexels-photo-3065209.jpeg?w=800&auto=compress",
  "zen-massage-almadies":  "https://images.pexels.com/photos/3997989/pexels-photo-3997989.jpeg?w=800&auto=compress",
  "bella-coiffure-mermoz": "https://images.pexels.com/photos/3992870/pexels-photo-3992870.jpeg?w=800&auto=compress",
  "king-barber-sicap":     "https://images.pexels.com/photos/1319461/pexels-photo-1319461.jpeg?w=800&auto=compress",
  "nails-paradise-thies":  "https://images.pexels.com/photos/3997386/pexels-photo-3997386.jpeg?w=800&auto=compress",
};

async function main() {
  for (const [slug, coverUrl] of Object.entries(PHOTOS)) {
    const result = await prisma.tenant.updateMany({ where: { slug }, data: { coverUrl } });
    console.log(`✓ ${slug}: ${result.count} updated`);
  }
  await prisma.$disconnect();
}
main().catch(console.error);
