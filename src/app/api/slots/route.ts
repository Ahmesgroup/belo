// ============================================================
// app/api/slots/route.ts
// GET  /api/slots  → créneaux disponibles pour le client
// POST /api/slots  → générer des créneaux (gérant uniquement)
//
// Logique de coût Neon :
//   - Index @@index([tenantId, startsAt, isAvailable])
//     → la requête touche seulement les rows du tenant + jour
//   - Pas de SELECT * : on projette uniquement les colonnes utiles
//   - Cache headers HTTP (Cache-Control) pour réduire les appels
//     répétés sur la même URL (60s de cache navigateur)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth, withRole } from "@/middleware";
import { zodErrorResponse } from "@/lib/zod-formatter";
import { AppError } from "@/shared/errors";
import { rateLimit } from "@/lib/rate-limit";

// ── SCHEMAS ───────────────────────────────────────────────────

const GetSlotsSchema = z.object({
  tenantId:  z.string().cuid("Salon invalide"),
  serviceId: z.string().min(1).optional(),   // min(1) not cuid() — seed IDs may not be CUID format
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date attendu : YYYY-MM-DD").optional(),
});

// Pour générer des créneaux en masse (gérant)
const GenerateSlotsSchema = z.object({
  serviceId:  z.string().min(1).optional(),    // null = tous les services
  startDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  openTime:   z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
  closeTime:  z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
  slotDurationMin: z.coerce.number().int().min(15).max(480).default(60),
  breakStart: z.string().regex(/^\d{2}:\d{2}$/).optional(), // pause déjeuner
  breakEnd:   z.string().regex(/^\d{2}:\d{2}$/).optional(),
  excludeDays: z.array(z.number().int().min(0).max(6)).default([]), // 0=dim, 6=sam
});

type GenerateSlotsInput = z.infer<typeof GenerateSlotsSchema>;

// ── GET /api/slots ────────────────────────────────────────────
// Public (pas besoin d'être connecté pour voir les créneaux dispo)

export async function GET(req: NextRequest) {
  try {
    // Rate limit léger — requête publique
    const limited = await rateLimit(req, { max: 60, windowMs: 60_000 });
    if (limited) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Trop de requêtes." } },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const parsed = GetSlotsSchema.safeParse({
      tenantId:  searchParams.get("tenantId"),
      serviceId: searchParams.get("serviceId") ?? undefined,
      date:      searchParams.get("date") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        zodErrorResponse(parsed.error),
        { status: 422 }
      );
    }

    const { tenantId, serviceId, date } = parsed.data;

    // Fenêtre temporelle : date spécifique ou 7 prochains jours
    const dayStart = date
      ? new Date(`${date}T00:00:00.000Z`)
      : new Date();
    const dayEnd = date
      ? new Date(`${date}T23:59:59.999Z`)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Requête optimisée — projection minimale + index utilisé
    const slots = await prisma.slot.findMany({
      where: {
        tenantId,
        isAvailable: true,
        startsAt: {
          gte: dayStart,
          lte: dayEnd,
        },
        // Si serviceId fourni, filtrer les slots liés à ce service
        ...(serviceId ? { serviceId } : {}),
        // Exclure les slots dans le passé (min 15 min d'avance)
        // On ajoute 15 min au moment actuel
        AND: {
          startsAt: {
            gt: new Date(Date.now() + 15 * 60 * 1000),
          },
        },
      },
      select: {
        id:          true,
        startsAt:    true,
        endsAt:      true,
        isAvailable: true,
        serviceId:   true,
      },
      orderBy: { startsAt: "asc" },
    });

    // Grouper par heure pour l'affichage (matin / après-midi / soir)
    const grouped = groupSlotsByPeriod(slots);

    return NextResponse.json(
      { data: { slots, grouped, date: date ?? null, count: slots.length } },
      {
        status: 200,
        headers: {
          // Cache 60s côté navigateur — réduit les appels répétés
          // Invalider manuellement côté client après une réservation
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        },
      }
    );

  } catch (err) {
    return handleError(err);
  }
}

// ── POST /api/slots ───────────────────────────────────────────
// Générer des créneaux pour une période (gérant ou admin)

export async function POST(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    const roleCheck = withRole(auth, ["OWNER", "STAFF", "ADMIN", "SUPER_ADMIN"]);
    if (!roleCheck.ok) return roleCheck.response;

    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return NextResponse.json(
        { error: { code: "MISSING_TENANT", message: "Contexte salon manquant." } },
        { status: 400 }
      );
    }

    const raw = await req.json().catch(() => null);
    if (!raw) {
      return NextResponse.json(
        { error: { code: "INVALID_JSON" } },
        { status: 400 }
      );
    }

    const parsed = GenerateSlotsSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        zodErrorResponse(parsed.error),
        { status: 422 }
      );
    }

    const result = await generateSlots(tenantId, parsed.data);

    return NextResponse.json(
      { data: result },
      { status: 201 }
    );

  } catch (err) {
    return handleError(err);
  }
}

// ── DELETE /api/slots?slotId=xxx ──────────────────────────────
// Supprimer un créneau (gérant)

export async function DELETE(req: NextRequest) {
  try {
    const auth = await withAuth(req);
    const roleCheck = withRole(auth, ["OWNER", "STAFF", "ADMIN", "SUPER_ADMIN"]);
    if (!roleCheck.ok) return roleCheck.response;

    const tenantId = req.headers.get("x-tenant-id");
    const slotId   = new URL(req.url).searchParams.get("slotId");

    if (!tenantId || !slotId) {
      return NextResponse.json(
        { error: { code: "MISSING_PARAMS", message: "slotId requis." } },
        { status: 400 }
      );
    }

    // Vérifier que le slot appartient au tenant (sécurité cross-tenant)
    const slot = await prisma.slot.findFirst({
      where: { id: slotId, tenantId },
      select: { id: true, isAvailable: true },
    });

    if (!slot) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Créneau introuvable." } },
        { status: 404 }
      );
    }

    // Ne pas supprimer un slot déjà réservé
    if (!slot.isAvailable) {
      return NextResponse.json(
        {
          error: {
            code: "SLOT_BOOKED",
            message: "Ce créneau est déjà réservé et ne peut pas être supprimé.",
          },
        },
        { status: 409 }
      );
    }

    await prisma.slot.delete({ where: { id: slotId } });

    return NextResponse.json({ data: { deleted: true } });

  } catch (err) {
    return handleError(err);
  }
}

// ── GÉNÉRATION DE CRÉNEAUX ────────────────────────────────────

async function generateSlots(
  tenantId: string,
  input: GenerateSlotsInput
): Promise<{ created: number; skipped: number; dates: string[] }> {
  const {
    serviceId,
    startDate,
    endDate,
    openTime,
    closeTime,
    slotDurationMin,
    breakStart,
    breakEnd,
    excludeDays,
  } = input;

  // Validation logique des dates
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end   = new Date(`${endDate}T23:59:59.999Z`);

  if (end < start) {
    throw new AppError(
      "INVALID_DATE_RANGE",
      "La date de fin doit être après la date de début."
    );
  }

  // Limiter à 90 jours max (éviter les millions de rows)
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
  if (diffDays > 90) {
    throw new AppError(
      "DATE_RANGE_TOO_LARGE",
      "Impossible de générer plus de 90 jours de créneaux à la fois."
    );
  }

  // Parser les heures
  const [openH, openM]   = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);
  const [breakSH, breakSM] = breakStart?.split(":").map(Number) ?? [null, null];
  const [breakEH, breakEM] = breakEnd?.split(":").map(Number)   ?? [null, null];

  const slotsToCreate: Array<{
    tenantId:    string;
    serviceId:   string | null;
    startsAt:    Date;
    endsAt:      Date;
    isAvailable: boolean;
  }> = [];

  // Itérer sur chaque jour de la période
  const current = new Date(start);
  const processedDates: string[] = [];

  while (current <= end) {
    const dayOfWeek = current.getUTCDay(); // 0=dim, 1=lun...6=sam

    // Sauter les jours exclus (ex: dimanche)
    if (!excludeDays.includes(dayOfWeek)) {
      const dateStr = current.toISOString().slice(0, 10);
      processedDates.push(dateStr);

      // Générer les créneaux de la journée
      let slotStart = new Date(current);
      slotStart.setUTCHours(openH!, openM!, 0, 0);

      const dayClose = new Date(current);
      dayClose.setUTCHours(closeH!, closeM!, 0, 0);

      while (slotStart < dayClose) {
        const slotEnd = new Date(
          slotStart.getTime() + slotDurationMin * 60_000
        );

        // Ne pas créer un créneau qui dépasse l'heure de fermeture
        if (slotEnd > dayClose) break;

        // Vérifier si le créneau est dans la pause déjeuner
        const inBreak =
          breakSH !== null &&
          breakEH !== null &&
          (() => {
            const slotStartMin = slotStart.getUTCHours() * 60 + slotStart.getUTCMinutes();
            const slotEndMin   = slotEnd.getUTCHours()   * 60 + slotEnd.getUTCMinutes();
            const breakStartMin = breakSH * 60 + breakSM!;
            const breakEndMin   = breakEH * 60 + breakEM!;
            // Le créneau chevauche la pause si son début est avant la fin de pause
            // ET sa fin est après le début de pause
            return slotStartMin < breakEndMin && slotEndMin > breakStartMin;
          })();

        if (!inBreak) {
          slotsToCreate.push({
            tenantId,
            serviceId: serviceId ?? null,
            startsAt:  new Date(slotStart),
            endsAt:    new Date(slotEnd),
            isAvailable: true,
          });
        }

        // Avancer au créneau suivant
        slotStart = new Date(slotStart.getTime() + slotDurationMin * 60_000);
      }
    }

    // Jour suivant
    current.setUTCDate(current.getUTCDate() + 1);
  }

  if (slotsToCreate.length === 0) {
    return { created: 0, skipped: 0, dates: processedDates };
  }

  // Vérifier les doublons (slots qui existent déjà pour ce tenant + période)
  const existingSlots = await prisma.slot.findMany({
    where: {
      tenantId,
      startsAt: {
        gte: start,
        lte: end,
      },
    },
    select: { startsAt: true, serviceId: true },
  });

  const existingKeys = new Set(
    existingSlots.map(
      (s) => `${s.startsAt.toISOString()}-${s.serviceId ?? "null"}`
    )
  );

  const newSlots = slotsToCreate.filter(
    (s) =>
      !existingKeys.has(
        `${s.startsAt.toISOString()}-${s.serviceId ?? "null"}`
      )
  );

  const skipped = slotsToCreate.length - newSlots.length;

  // Insérer en batch (createMany = 1 seule requête SQL)
  // Neon facture par compute time, pas par requête — 1 INSERT massif
  // est bien moins cher que N INSERT individuels
  if (newSlots.length > 0) {
    await prisma.slot.createMany({
      data:           newSlots,
      skipDuplicates: true, // sécurité supplémentaire au niveau DB
    });
  }

  return {
    created: newSlots.length,
    skipped,
    dates:   processedDates,
  };
}

// ── HELPER : grouper par période de la journée ────────────────

function groupSlotsByPeriod(
  slots: Array<{ id: string; startsAt: Date; endsAt: Date }>
) {
  const morning:   typeof slots = [];
  const afternoon: typeof slots = [];
  const evening:   typeof slots = [];

  for (const slot of slots) {
    const hour = slot.startsAt.getUTCHours();
    if      (hour < 12) morning.push(slot);
    else if (hour < 17) afternoon.push(slot);
    else                evening.push(slot);
  }

  return { morning, afternoon, evening };
}

// ── ERROR HANDLER ─────────────────────────────────────────────

function handleError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(err.toJSON(), { status: err.statusCode });
  }
  console.error("[API /slots]", err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Erreur serveur." } },
    { status: 500 }
  );
}
