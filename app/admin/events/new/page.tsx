"use client";

import { useState } from "react";

import { createEvent } from "@/lib/actions/event.actions";
import { eventCreateSchema } from "@/lib/validators/event.schema";

type FormValues = {
  title: string;
  description: string;
  overview: string;
  eventDate: string;
  mode: "ONLINE" | "OFFLINE" | "HYBRID";
  priceInPesewas: number;
  capacity: number | null;
  agenda: string[];
  tags: string[];
  imageUrl: string;
  venue: string;
  location: string;
  audience: string;
  organizer: string;
};

const EMPTY: FormValues = {
  title: "",
  description: "",
  overview: "",
  eventDate: "",
  mode: "OFFLINE",
  priceInPesewas: 0,
  capacity: null,
  agenda: [],
  tags: [],
  imageUrl: "",
  venue: "",
  location: "",
  audience: "",
  organizer: "",
};

// Sunk below the card rather than raised above it: `bg-background` is darker
// than `bg-card`, so the field reads as a well cut into the panel.
const inputClass =
  "border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-shadow focus-visible:ring-[3px] focus-visible:outline-none";
const labelClass = "text-muted-foreground block text-sm font-medium";

export default function AdminEventNewPage() {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const parsed = eventCreateSchema.safeParse(values);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      setLoading(false);
      return;
    }

    const result = await createEvent(parsed.data);

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setValues(EMPTY);
    setLoading(false);
  }

  return (
    <div className="border-border bg-card mx-auto max-w-2xl rounded-xl border p-6 shadow-sm">
      <h2 className="mb-6 text-2xl font-bold tracking-tight">New Event</h2>

      {error && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-md border p-3 text-sm"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="title">
            Title
          </label>
          <input
            id="title"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="overview">
            Overview
          </label>
          <textarea
            id="overview"
            value={values.overview}
            onChange={(e) => set("overview", e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="eventDate">
              Event Date
            </label>
            <input
              id="eventDate"
              type="date"
              value={values.eventDate}
              onChange={(e) => set("eventDate", e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="mode">
              Mode
            </label>
            <select
              id="mode"
              value={values.mode}
              onChange={(e) => set("mode", e.target.value as FormValues["mode"])}
              className={inputClass}
            >
              <option value="OFFLINE">Offline</option>
              <option value="ONLINE">Online</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="venue">
              Venue
            </label>
            <input
              id="venue"
              value={values.venue}
              onChange={(e) => set("venue", e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="location">
              Location
            </label>
            <input
              id="location"
              value={values.location}
              onChange={(e) => set("location", e.target.value)}
              required
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="audience">
              Audience
            </label>
            <input
              id="audience"
              value={values.audience}
              onChange={(e) => set("audience", e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="organizer">
              Organizer
            </label>
            <input
              id="organizer"
              value={values.organizer}
              onChange={(e) => set("organizer", e.target.value)}
              required
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="priceInPesewas">
              Price (pesewas)
            </label>
            <input
              id="priceInPesewas"
              type="number"
              min={0}
              step={1}
              value={values.priceInPesewas}
              onChange={(e) => set("priceInPesewas", Number(e.target.value) || 0)}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="capacity">
              Capacity (blank = unlimited)
            </label>
            <input
              id="capacity"
              type="number"
              min={1}
              step={1}
              value={values.capacity ?? ""}
              onChange={(e) => set("capacity", e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="agenda">
            Agenda (comma-separated)
          </label>
          <input
            id="agenda"
            value={values.agenda.join(", ")}
            onChange={(e) =>
              set(
                "agenda",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="tags">
            Tags (comma-separated)
          </label>
          <input
            id="tags"
            value={values.tags.join(", ")}
            onChange={(e) =>
              set(
                "tags",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="imageUrl">
            Image URL
          </label>
          <input
            id="imageUrl"
            type="url"
            value={values.imageUrl}
            onChange={(e) => set("imageUrl", e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50 flex w-full cursor-pointer justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Event"}
        </button>
      </form>
    </div>
  );
}
