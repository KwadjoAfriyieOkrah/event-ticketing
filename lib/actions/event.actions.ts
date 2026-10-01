"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { generateUniqueSlug } from "@/lib/slug";
import { eventCreateSchema, eventWriteSchema } from "@/lib/validators/event.schema";

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export async function createEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!(await rateLimit(`event:create:${session.user.id}`, 10, 60_000)).success) {
    return { success: false, error: "Too many requests. Please try again shortly." };
  }

  const result = eventCreateSchema.safeParse(input);
  if (!result.success) return { success: false, error: firstIssue(result.error) };

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
    select: { id: true },
  });

  revalidatePath("/");
  revalidatePath("/admin/events");

  return { success: true, data: { id: event.id } };
}

export async function updateEvent(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  if (typeof id !== "string" || id.length === 0) {
    return { success: false, error: "Invalid event id" };
  }

  const result = eventWriteSchema.safeParse(input);
  if (!result.success) return { success: false, error: firstIssue(result.error) };

  const data = result.data;

  const current = await prisma.event.findUnique({
    where: { id },
    select: { ticketsSold: true },
  });

  if (!current) return { success: false, error: "Event not found" };

  if (data.capacity != null && data.capacity < current.ticketsSold) {
    return {
      success: false,
      error: `Capacity cannot be lower than tickets sold (${current.ticketsSold})`,
    };
  }

  const slug = await generateUniqueSlug(data.title, id);

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
    select: { id: true },
  });

  revalidatePath("/");
  revalidatePath("/admin/events");

  return { success: true, data: { id: event.id } };
}

export async function deleteEvent(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  if (typeof id !== "string" || id.length === 0) {
    return { success: false, error: "Invalid event id" };
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, ticketsSold: true },
  });

  if (!event) return { success: false, error: "Event not found" };

  if (event.ticketsSold > 0) {
    return { success: false, error: "Cannot delete an event that has sold tickets" };
  }

  await prisma.event.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/admin/events");

  return { success: true, data: { id: event.id } };
}
