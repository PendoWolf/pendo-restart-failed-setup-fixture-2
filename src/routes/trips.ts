import { Router } from "express";
import type { AuthLocals } from "../auth/require-auth.js";
import { trackEvent } from "../pendo/track.js";
import { tripStore } from "../store/trips.js";
import type { NewTrip } from "../types.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const TRIP_FIELDS: (keyof NewTrip)[] = ["destination", "startDate", "endDate", "travelers"];
/** The most of a destination a Pendo event carries, to keep within Pendo's size limit for event properties. */
const MAX_TRACKED_DESTINATION = 80;

/** Returns why `body` isn't a valid trip, or null when it is. */
function validateNewTrip(body: Partial<NewTrip> | undefined): string | null {
  if (!body || typeof body.destination !== "string" || body.destination.trim() === "") {
    return "destination is required";
  }
  if (typeof body.startDate !== "string" || !ISO_DATE.test(body.startDate)) {
    return "startDate must be a date like 2026-11-03";
  }
  if (typeof body.endDate !== "string" || !ISO_DATE.test(body.endDate)) {
    return "endDate must be a date like 2026-11-08";
  }
  if (body.endDate < body.startDate) {
    return "endDate must be on or after startDate";
  }
  if (!Number.isInteger(body.travelers) || (body.travelers as number) < 1) {
    return "travelers must be a whole number of at least 1";
  }
  return null;
}

/** Whole days from one ISO date to another: negative when `to` is earlier. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** How many days the trip lasts, counting both ends, and how many days from today it starts. */
function tripTiming({ startDate, endDate }: NewTrip): { tripLengthDays: number; daysUntilStart: number } {
  const today = new Date().toISOString().slice(0, 10);
  return { tripLengthDays: daysBetween(startDate, endDate) + 1, daysUntilStart: daysBetween(today, startDate) };
}

export const tripsRouter = Router();

tripsRouter.get("/", (_req, res) => {
  res.json(tripStore.list());
});

tripsRouter.post("/", (req, res) => {
  const body = req.body as Partial<NewTrip> | undefined;
  const problem = validateNewTrip(body);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const trip = tripStore.create({
    destination: body!.destination!.trim(),
    startDate: body!.startDate!,
    endDate: body!.endDate!,
    travelers: body!.travelers!,
  });
  // Pendo: a trip was saved, with what was planned.
  const signedIn = res.locals as AuthLocals;
  trackEvent({
    event: "trip_created",
    visitorId: signedIn.user.id,
    accountId: signedIn.account.id,
    properties: {
      tripId: trip.id,
      destination: trip.destination.slice(0, MAX_TRACKED_DESTINATION),
      startDate: trip.startDate,
      endDate: trip.endDate,
      ...tripTiming(trip),
      travelers: trip.travelers,
    },
  });
  res.status(201).json(trip);
});

tripsRouter.get("/:id", (req, res) => {
  const trip = tripStore.get(req.params.id);
  if (!trip) {
    res.status(404).json({ error: "trip not found" });
    return;
  }
  res.json(trip);
});

tripsRouter.put("/:id", (req, res) => {
  const body = req.body as Partial<NewTrip> | undefined;
  const problem = validateNewTrip(body);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  // Read before the update: the body always resends every field, so only this shows what changed.
  const previous = tripStore.get(req.params.id);
  const trip = tripStore.update(req.params.id, {
    destination: body!.destination!.trim(),
    startDate: body!.startDate!,
    endDate: body!.endDate!,
    travelers: body!.travelers!,
  });
  if (!trip) {
    res.status(404).json({ error: "trip not found" });
    return;
  }
  // Pendo: a trip's details were saved, with which of them changed.
  const signedIn = res.locals as AuthLocals;
  trackEvent({
    event: "trip_updated",
    visitorId: signedIn.user.id,
    accountId: signedIn.account.id,
    properties: {
      tripId: trip.id,
      changedFields: TRIP_FIELDS.filter((field) => previous?.[field] !== trip[field]),
      travelers: trip.travelers,
      ...tripTiming(trip),
    },
  });
  res.json(trip);
});

tripsRouter.delete("/:id", (req, res) => {
  if (!tripStore.remove(req.params.id)) {
    res.status(404).json({ error: "trip not found" });
    return;
  }
  res.status(204).end();
});
