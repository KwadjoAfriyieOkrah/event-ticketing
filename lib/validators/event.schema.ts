import { z } from "zod";

export const eventWriteSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(100, "Title must be at most 100 characters"),
    description: z
      .string()
      .max(1000, "Description must be at most 1000 characters")
      .default(""),
    overview: z
      .string()
      .max(500, "Overview must be at most 500 characters")
      .default(""),
    eventDate: z
      .string()
      .refine((date) => !isNaN(new Date(date).getTime()), {
        message: "eventDate must be a valid date",
      })
      .refine((date) => new Date(date) > new Date(), {
        message: "eventDate must be a future date",
      }),
    mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]),
    priceInPesewas: z
      .number()
      .int("priceInPesewas must be an integer number of pesewas")
      .min(0, "priceInPesewas must be >= 0"),
    capacity: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional(),
    agenda: z.array(z.string().min(1)).min(1, "agenda must have at least 1 item"),
    tags: z.array(z.string().min(1)).min(1, "tags must have at least 1 item"),
    imageUrl: z.string().url("imageUrl must be a valid URL"),
    venue: z.string().min(1, "venue is required").max(150),
    location: z.string().min(1, "location is required").max(150),
    audience: z.string().min(1, "audience is required").max(150),
    organizer: z.string().min(1, "organizer is required").max(150),
  })
  .strict();

export const eventCreateSchema = eventWriteSchema.extend({
  capacity: z.number().int().positive().nullable().optional(),
});

export type EventWriteInput = z.infer<typeof eventWriteSchema>;
