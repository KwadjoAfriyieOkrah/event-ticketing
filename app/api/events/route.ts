import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { badRequest, requireAdmin, unauthorized } from "@/lib/require-admin";
import { rateLimit } from "@/lib/rate-limit";
import { generateUniqueSlug } from "@/lib/slug";
import { eventWriteSchema } from "@/lib/validators/event.schema";

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();

  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const limit = rateLimit(`event:create:${session.user.id}`, 10, 60_000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const result = eventWriteSchema.safeParse(body);
  if (!result.success) {
    return badRequest("Validation failed", zodIssues(result.error));
  }

  const data = result.data;
  const slug = await generateUniqueSlug(data.title);

  const event = await prisma.event.create({
    data: {
      title: data.title,
      slug,
      description: data.description,
      overview: data.overview,
      imageUrl: data.imageUrl,
      venue: data.venue,
      location: data.location,
      eventDate: new Date(data.eventDate),
      mode: data.mode,
      audience: data.audience,
      agenda: data.agenda,
      organizer: data.organizer,
      organizerId: session.user.id,
      tags: data.tags,
      priceInPesewas: data.priceInPesewas,
      capacity: data.capacity ?? null,
    },
  });

  return NextResponse.json(event, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (typeof body !== "object" || body === null || !("id" in body)) {
    return badRequest("id is required");
  }

  const { id, ...rest } = body as { id: unknown } & Record<string, unknown>;

  if (typeof id !== "string" || id.length === 0) {
    return badRequest("id must be a non-empty string");
  }

  const result = eventWriteSchema.safeParse(rest);
  if (!result.success) {
    return badRequest("Validation failed", zodIssues(result.error));
  }

  const data = result.data;

  const current = await prisma.event.findUnique({
    where: { id },
    select: { slug: true, ticketsSold: true, capacity: true },
  });

  if (!current) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (data.capacity != null && data.capacity < current.ticketsSold) {
    return badRequest(`capacity cannot be lower than ticketsSold (${current.ticketsSold})`);
  }

  const slug = data.title ? await generateUniqueSlug(data.title, id) : current.slug;

  const event = await prisma.event.update({
    where: { id },
    data: {
      title: data.title,
      slug,
      description: data.description,
      overview: data.overview,
      imageUrl: data.imageUrl,
      venue: data.venue,
      location: data.location,
      eventDate: new Date(data.eventDate),
      mode: data.mode,
      audience: data.audience,
      agenda: data.agenda,
      organizer: data.organizer,
      tags: data.tags,
      priceInPesewas: data.priceInPesewas,
      capacity: data.capacity ?? null,
    },
  });

  return NextResponse.json(event);
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return badRequest("Missing event ID");
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: { ticketsSold: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.ticketsSold > 0) {
    return NextResponse.json(
      { error: "Cannot delete an event that has sold tickets" },
      { status: 409 },
    );
  }

  await prisma.event.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}

function zodIssues(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
