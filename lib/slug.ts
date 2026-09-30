import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title) || "event";

  const existing = await prisma.event.findMany({
    where: excludeId ? { NOT: { id: excludeId } } : undefined,
    select: { slug: true },
  });

  const taken = new Set(existing.map((e) => e.slug));
  if (!taken.has(base)) return base;

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `${base}-${randomBytes(3).toString("hex")}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${base}-${randomBytes(8).toString("hex")}`;
}
