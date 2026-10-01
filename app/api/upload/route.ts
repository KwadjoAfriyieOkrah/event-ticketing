import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";

const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_FORMATS: Record<string, { mime: string; cloudinary: string }> = {
  jpg: { mime: "image/jpeg", cloudinary: "jpg" },
  jpeg: { mime: "image/jpeg", cloudinary: "jpg" },
  png: { mime: "image/png", cloudinary: "png" },
  webp: { mime: "image/webp", cloudinary: "webp" },
};

const MAGIC: Record<string, (b: Buffer) => boolean> = {
  jpg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  jpeg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) =>
    b.length > 4 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d,
  webp: (b) =>
    b.length > 12 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP",
};

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const limit = await rateLimit(`upload:${session.user.id}`, 20, 60_000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many uploads" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)) } },
    );
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Upload not configured" }, { status: 500 });
  }

  let file: FormDataEntryValue | null;
  try {
    const data = await request.formData();
    file = data.get("file");
  } catch {
    return badRequest("Invalid multipart body");
  }

  if (!(file instanceof File)) {
    return badRequest("No file uploaded");
  }

  if (file.size === 0) {
    return badRequest("File is empty");
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const allowed = ALLOWED_FORMATS[ext];

  if (!allowed) {
    return badRequest("Only JPEG, PNG or WebP images are allowed");
  }

  if (file.type && file.type !== allowed.mime) {
    return badRequest("File type does not match its extension");
  }

  if (!MAGIC[ext](bytes)) {
    return badRequest("File content is not a valid image");
  }

  const formData = new FormData();
  formData.append("file", new Blob([bytes], { type: allowed.mime }), `upload.${allowed.cloudinary}`);
  formData.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET ?? "event-ticketing");
  formData.append("folder", "event-ticketing");

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Cloudinary upload failed", response.status, detail);
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }

  const result = (await response.json()) as {
    secure_url?: string;
    public_id?: string;
    error?: { message?: string };
  };

  if (result.error || !result.secure_url) {
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }

  return NextResponse.json({ secure_url: result.secure_url, public_id: result.public_id });
}
