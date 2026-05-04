// GET /api/tenants/search
// Geo-aware, ranked salon search.
// Combines Haversine distance, quality metrics, trending and ad boost.

import "@/lib/event-handlers";

import { NextRequest, NextResponse } from "next/server";
import { z }                from "zod";
import { searchRanked }     from "@/services/ranking.service";
import { getCorsHeaders }   from "@/lib/cors";

const QuerySchema = z.object({
  lat:      z.coerce.number().min(-90).max(90).optional(),
  lng:      z.coerce.number().min(-180).max(180).optional(),
  city:     z.string().max(100).optional(),
  category: z.string().max(50).optional(),
  radius:   z.coerce.number().min(1).max(200).default(30),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const parsed = QuerySchema.safeParse({
      lat:      searchParams.get("lat")      ?? undefined,
      lng:      searchParams.get("lng")      ?? undefined,
      city:     searchParams.get("city")     ?? undefined,
      category: searchParams.get("category") ?? undefined,
      radius:   searchParams.get("radius")   ?? 30,
      page:     searchParams.get("page")     ?? 1,
      pageSize: searchParams.get("pageSize") ?? 20,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_PARAMS", fields: parsed.error.flatten() } },
        { status: 422 }
      );
    }

    const result = await searchRanked(parsed.data);

    return NextResponse.json(
      { data: result },
      {
        headers: {
          ...getCorsHeaders(req),
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("[Search]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Search failed." } },
      { status: 500, headers: getCorsHeaders(req) }
    );
  }
}
