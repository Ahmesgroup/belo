import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/middleware";

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if (!auth.ok || (auth.role !== "OWNER" && auth.role !== "STAFF" && auth.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: { code: "INVALID_FORM" } }, { status: 400 });

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: { code: "NO_FILE" } }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: { code: "INVALID_TYPE", message: "JPG, PNG ou WebP uniquement." } }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: { code: "FILE_TOO_LARGE", message: "5 MB maximum." } }, { status: 400 });
  }

  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
  const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
  const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
  const R2_BUCKET     = process.env.R2_BUCKET ?? "belo-media";

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    // Dev mode — return a placeholder
    return NextResponse.json({
      data: { url: `https://placehold.co/800x500/0d9e6e/ffffff?text=${encodeURIComponent(file.name)}` }
    });
  }

  try {
    const { AwsClient } = await import("aws4fetch");
    const aws = new AwsClient({ accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY, service: "s3" });
    const ext = file.name.split(".").pop() ?? "jpg";
    const key = `salons/${auth.tenantId ?? "public"}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
    const bytes = await file.arrayBuffer();
    const r2Req = new Request(endpoint, {
      method: "PUT", body: bytes,
      headers: { "Content-Type": file.type, "Content-Length": bytes.byteLength.toString() },
    });
    const signed = await aws.sign(r2Req);
    const res = await fetch(signed);
    if (!res.ok) throw new Error(`R2: ${res.status}`);
    const cdnBase = process.env.NEXT_PUBLIC_CDN_URL ?? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;
    return NextResponse.json({ data: { url: `${cdnBase}/${key}` } });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: { code: "UPLOAD_FAILED" } }, { status: 500 });
  }
}
