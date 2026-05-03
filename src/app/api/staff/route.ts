import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { withAuth } from "@/lib/route-auth";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if (!auth.ok || (auth.role !== "OWNER" && auth.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const tenantId = req.nextUrl.searchParams.get("tenantId") ?? auth.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: { code: "MISSING_TENANT" } }, { status: 400 });
  }
  const staff = await prisma.user.findMany({
    where:   { tenantId, role: "STAFF", deletedAt: null },
    select:  { id: true, name: true, phone: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ data: { staff } });
}

const CreateSchema = z.object({
  phone: z.string().min(8),
  name:  z.string().min(2),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if (!auth.ok || auth.role !== "OWNER") {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  if (!auth.tenantId) {
    return NextResponse.json({ error: { code: "MISSING_TENANT" } }, { status: 400 });
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: auth.tenantId } });
  if (!tenant || tenant.plan !== "PREMIUM") {
    return NextResponse.json(
      { error: { code: "PLAN_REQUIRED", message: "Multi-staff nécessite le plan Premium." } },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_DATA" } }, { status: 422 });
  }
  const phone = parsed.data.phone.startsWith("+221")
    ? parsed.data.phone
    : "+221" + parsed.data.phone.replace(/^0+/, "");

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing?.tenantId === auth.tenantId) {
    return NextResponse.json(
      { error: { code: "ALREADY_STAFF", message: "Ce numéro est déjà dans votre équipe." } },
      { status: 409 }
    );
  }
  if (existing) {
    const updated = await prisma.user.update({
      where:  { phone },
      data:   { role: "STAFF", tenantId: auth.tenantId, name: parsed.data.name },
      select: { id: true, name: true, phone: true },
    });
    return NextResponse.json({ data: { staff: updated } }, { status: 201 });
  }
  const newStaff = await prisma.user.create({
    data:   { phone, name: parsed.data.name, role: "STAFF", tenantId: auth.tenantId },
    select: { id: true, name: true, phone: true },
  });
  return NextResponse.json({ data: { staff: newStaff } }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await withAuth(req);
  if (!auth.ok || auth.role !== "OWNER") {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const staffId = req.nextUrl.searchParams.get("staffId");
  if (!staffId) {
    return NextResponse.json({ error: { code: "MISSING_ID" } }, { status: 400 });
  }
  const staffUser = await prisma.user.findFirst({
    where: { id: staffId, tenantId: auth.tenantId!, role: "STAFF" },
  });
  if (!staffUser) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  await prisma.user.update({ where: { id: staffId }, data: { role: "CLIENT", tenantId: null } });
  return NextResponse.json({ data: { removed: true } });
}
