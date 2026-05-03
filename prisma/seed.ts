import { PrismaClient, Plan, TenantStatus, UserRole } from "@prisma/client";
const prisma = new PrismaClient();

async function upsertUser(phone: string, name: string, email: string | undefined, role: UserRole) {
  return prisma.user.upsert({
    where: { phone },
    update: {},
    create: { phone, name, email, role },
  });
}

async function main() {
  console.log("Seeding Belo...");

  await Promise.all([
    upsertUser("+221661000001","Pape Diouf","pape@belo.sn", UserRole.SUPER_ADMIN),
    upsertUser("+221771000001","Aminata Sarr","aminata@belo.sn", UserRole.ADMIN),
    upsertUser("+221772000001","Mamadou Diop","mamadou@belo.sn", UserRole.ADMIN),
    upsertUser("+221773000001","Fatou Ba","fatou@belo.sn", UserRole.ADMIN),
    upsertUser("+221774000001","Rokhaya Sow","rokhaya@belo.sn", UserRole.ADMIN),
  ]);
  console.log("Admins OK");

  const clients = await Promise.all([
    upsertUser("+221771234567","Aminata Diallo",undefined, UserRole.CLIENT),
    upsertUser("+221772345678","Fatou Ndiaye",undefined, UserRole.CLIENT),
    upsertUser("+221773456789","Mariama Bah",undefined, UserRole.CLIENT),
    upsertUser("+221774567890","Rokhaya Seck",undefined, UserRole.CLIENT),
    upsertUser("+221775678901","Sokhna Diop",undefined, UserRole.CLIENT),
  ]);
  console.log("Clients OK");

  const salons = [
    {
      name:"Studio Elegance", slug:"studio-elegance-dakar",
      city:"Dakar", address:"12 Avenue Cheikh Anta Diop, Plateau",
      phone:"+221771111001", plan:Plan.PREMIUM, status:TenantStatus.ACTIVE,
      depositEnabled:true, depositPercent:30,
      ownerPhone:"+221771111000", ownerName:"Awa Diallo",
      services:[
        {name:"Pose ongles gel premium", category:"nails",  priceCents:1200000, durationMin:60},
        {name:"Soin visage eclat",       category:"beauty", priceCents:1500000, durationMin:45},
        {name:"Nail art complet",        category:"nails",  priceCents:1800000, durationMin:90},
      ],
    },
    {
      name:"Zen Massage Center", slug:"zen-massage-almadies",
      city:"Dakar", address:"45 Route de la Corniche, Almadies",
      phone:"+221772222001", plan:Plan.PREMIUM, status:TenantStatus.ACTIVE,
      depositEnabled:true, depositPercent:50,
      ownerPhone:"+221772222000", ownerName:"Fatou Sarr",
      services:[
        {name:"Massage relaxant", category:"massage", priceCents:1500000, durationMin:45},
        {name:"Massage deep tissue", category:"massage", priceCents:2000000, durationMin:60},
      ],
    },
    {
      name:"Bella Coiffure", slug:"bella-coiffure-mermoz",
      city:"Dakar", address:"7 Rue 10, Mermoz",
      phone:"+221773333001", plan:Plan.PRO, status:TenantStatus.ACTIVE,
      depositEnabled:true, depositPercent:20,
      ownerPhone:"+221773333000", ownerName:"Mareme Ndiaye",
      services:[
        {name:"Coiffure et styling", category:"hair", priceCents:2000000, durationMin:90},
        {name:"Tresses africaines",  category:"hair", priceCents:3500000, durationMin:180},
      ],
    },
    {
      name:"King Barber Dakar", slug:"king-barber-sicap",
      city:"Dakar", address:"23 Rue Dial Diop, Sicap",
      phone:"+221774444001", plan:Plan.PRO, status:TenantStatus.ACTIVE,
      depositEnabled:false, depositPercent:30,
      ownerPhone:"+221774444000", ownerName:"Ibrahima Fall",
      services:[
        {name:"Coupe classique", category:"barber", priceCents:400000, durationMin:30},
        {name:"Coupe et barbe",  category:"barber", priceCents:600000, durationMin:45},
      ],
    },
    {
      name:"Nails Paradise", slug:"nails-paradise-thies",
      city:"Thies", address:"5 Avenue Lamine Gueye",
      phone:"+221776666001", plan:Plan.FREE, status:TenantStatus.ACTIVE,
      depositEnabled:false, depositPercent:30,
      ownerPhone:"+221776666000", ownerName:"Aicha Sow",
      services:[
        {name:"Pose ongles gel", category:"nails", priceCents:700000, durationMin:60},
      ],
    },
  ];

  const tenantMap: Record<string, string> = {};

  for (const s of salons) {
    const owner = await upsertUser(s.ownerPhone, s.ownerName, undefined, UserRole.OWNER);

    const tenant = await prisma.tenant.upsert({
      where:  { slug: s.slug },
      update: {},
      create: {
        name:          s.name,
        slug:          s.slug,
        city:          s.city,
        address:       s.address,
        phone:         s.phone,
        plan:          s.plan,
        status:        s.status,
        country:       "SN",
        depositEnabled:s.depositEnabled,
        depositPercent:s.depositPercent,
        users:         { connect: { id: owner.id } },
      },
    });

    await prisma.user.update({ where:{ id: owner.id }, data:{ tenantId: tenant.id } });
    tenantMap[s.slug] = tenant.id;

    // Delete dependents in FK order before re-creating services
    await prisma.review.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.notificationLog.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.booking.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.slot.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.service.deleteMany({ where: { tenantId: tenant.id } });

    // Create services — let Prisma auto-generate CUIDs
    for (const svc of s.services) {
      await prisma.service.create({
        data: { tenantId: tenant.id, ...svc },
      });
    }

    console.log("  Salon: " + s.name);
  }

  // Creneaux pour 14 jours (rapide)
  console.log("Generating slots...");
  for (const slug of Object.keys(tenantMap)) {
    const tenantId = tenantMap[slug];
    const svcs = await prisma.service.findMany({ where:{ tenantId }, select:{ id:true, durationMin:true } });
    // Slots were already cleared during service cleanup above; skip here

    const slots: { tenantId:string; serviceId:string; startsAt:Date; endsAt:Date; isAvailable:boolean }[] = [];
    const now = new Date();

    for (let d = 1; d <= 14; d++) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() + d);
      if (date.getUTCDay() === 0) continue; // skip Sunday

      for (let h = 9; h < 18; h++) {
        if (h === 12 || h === 13) continue;
        for (let si = 0; si < svcs.length; si++) {
          const svc = svcs[si];
          const st = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, 0, 0));
          const en = new Date(st.getTime() + svc.durationMin * 60000);
          if (en.getUTCHours() > 18) continue;
          slots.push({ tenantId, serviceId: svc.id, startsAt: st, endsAt: en, isAvailable: true });
        }
      }
    }

    for (let i = 0; i < slots.length; i += 100) {
      await prisma.slot.createMany({ data: slots.slice(i, i + 100), skipDuplicates: true });
    }
    console.log("  Slots " + slug + ": " + slots.length);
  }

  // Booking de test
  const studioId = tenantMap["studio-elegance-dakar"];
  if (studioId && clients[0]) {
    const svc  = await prisma.service.findFirst({ where:{ tenantId: studioId } });
    const slot = await prisma.slot.findFirst({ where:{ tenantId: studioId, isAvailable: true } });
    if (svc && slot) {
      const bk = await prisma.booking.upsert({
        where:  { idempotencyKey: "seed-bk-001" },
        update: {},
        create: {
          tenantId:       studioId,
          userId:         clients[0].id,
          serviceId:      svc.id,
          slotId:         slot.id,
          idempotencyKey: "seed-bk-001",
          status:         "CONFIRMED",
          paymentStatus:  "PAID",
          paymentProvider:"WAVE",
          priceCents:     svc.priceCents,
          depositCents:   Math.round(svc.priceCents * 0.3),
          currency:       "XOF",
        },
      });
      await prisma.slot.update({ where:{ id: slot.id }, data:{ isAvailable: false } });
      // Review liee au booking
      await prisma.review.upsert({
        where:  { bookingId: bk.id },
        update: {},
        create: {
          tenantId:  studioId,
          bookingId: bk.id,
          userId:    clients[0].id,
          rating:    5,
          comment:   "Service impeccable !",
        },
      });
    }
  }

  const u = await prisma.user.count();
  const t = await prisma.tenant.count();
  const sv = await prisma.service.count();
  const sl = await prisma.slot.count();
  console.log("\nSeed done! Users:" + u + " Tenants:" + t + " Services:" + sv + " Slots:" + sl);
}

main()
  .catch(function(e) { console.error(e); process.exit(1); })
  .finally(function() { return prisma.$disconnect(); });
