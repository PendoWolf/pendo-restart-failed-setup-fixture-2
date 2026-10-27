import { Router } from "express";
import { daysUntilStart, trackPendoEvent, tripLengthDays } from "../analytics/pendo.js";
import type { AuthLocals } from "../auth/require-auth.js";
import { tripStore } from "../store/trips.js";
import type { NewTrip, Trip } from "../types.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

/** The trip details that differ between `before` and `after`, named as in the Pendo event's properties. */
function changedTripFields(before: Trip, after: Trip): string[] {
  const fields: [string, keyof NewTrip][] = [
    ["destination", "destination"],
    ["start_date", "startDate"],
    ["end_date", "endDate"],
    ["travelers", "travelers"],
  ];
  return fields.filter(([, key]) => before[key] !== after[key]).map(([name]) => name);
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
  trackPendoEvent("trip_created", {
    visitorId: user.id,
    accountId: account.id,
    properties: {
      trip_id: trip.id,
      destination: trip.destination,
      travelers: trip.travelers,
      start_date: trip.startDate,
      end_date: trip.endDate,
      trip_length_days: tripLengthDays(trip.startDate, trip.endDate),
      days_until_start: daysUntilStart(trip.startDate),
      account_id: account.id,
      account_plan: account.plan,
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
  // Pendo: the update passed validation and was saved, with which of the trip's details changed.
  const { user, account } = res.locals as AuthLocals;
  trackPendoEvent("trip_updated", {
    visitorId: user.id,
    accountId: account.id,
    properties: {
      trip_id: trip.id,
      changed_fields: previous ? changedTripFields(previous, trip) : [],
      travelers: trip.travelers,
      trip_length_days: tripLengthDays(trip.startDate, trip.endDate),
      days_until_start: daysUntilStart(trip.startDate),
      account_id: account.id,
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
