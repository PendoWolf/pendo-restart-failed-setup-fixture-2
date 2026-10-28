import { Router } from "express";
import { trackEvent, truncate } from "../analytics/pendo.js";
import type { AuthLocals } from "../auth/require-auth.js";
import { tripStore } from "../store/trips.js";
import type { NewTrip, Trip } from "../types.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const TRIP_FIELDS: (keyof NewTrip)[] = ["destination", "startDate", "endDate", "travelers"];

/** Today as an ISO date, the way tripStore.upcoming() compares trip dates. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole days from one ISO date to another. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** The trip's details as Pendo Track Event properties. */
function tripProperties(trip: Trip) {
  return {
    tripId: trip.id,
    destination: truncate(trip.destination),
    startDate: trip.startDate,
    endDate: trip.endDate,
    travelers: trip.travelers,
  };
}

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
  // Pendo: the trip passed validation and was saved.
  const { user, account } = res.locals as AuthLocals;
  trackEvent("trip_created", {
    visitorId: user.id,
    accountId: account.id,
    properties: {
      ...tripProperties(trip),
      // Counting both the first and last day, so a same-day trip is 1 day long.
      tripLengthDays: daysBetween(trip.startDate, trip.endDate) + 1,
      daysUntilStart: daysBetween(today(), trip.startDate),
    },
    req,
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
  // Pendo: the edit passed validation and was saved.
  const { user, account } = res.locals as AuthLocals;
  trackEvent("trip_updated", {
    visitorId: user.id,
    accountId: account.id,
    properties: {
      ...tripProperties(trip),
      changedFields: TRIP_FIELDS.filter((field) => previous?.[field] !== trip[field]),
    },
    req,
  });
  res.json(trip);
});

tripsRouter.delete("/:id", (req, res) => {
  const trip = tripStore.get(req.params.id);
  if (!trip || !tripStore.remove(req.params.id)) {
    res.status(404).json({ error: "trip not found" });
    return;
  }
  // Pendo: the trip was really deleted.
  const { user, account } = res.locals as AuthLocals;
  trackEvent("trip_deleted", {
    visitorId: user.id,
    accountId: account.id,
    properties: {
      tripId: trip.id,
      destination: truncate(trip.destination),
      travelers: trip.travelers,
      wasUpcoming: trip.endDate >= today(),
    },
    req,
  });
  res.status(204).end();
});
