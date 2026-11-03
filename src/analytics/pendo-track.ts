// Server-side Pendo Track Events, sent to Pendo's Track API (POST /data/track).
// The integration key is read from PENDO_TRACK_EVENT_SECRET and is never committed. Without it, events are skipped.

const DEFAULT_PENDO_DATA_HOST = "data.pendo-dev.pendo-dev.com";

export type TrackPropertyValue = string | number | boolean | string[];

export interface TrackEvent {
  /** The Pendo track type's name, exactly as registered in Pendo. */
  event: string;
  /** The signed-in user who caused the event. */
  visitorId: string;
  /** The signed-in user's account. */
  accountId: string;
  properties?: Record<string, TrackPropertyValue>;
}

let warnedMissingSecret = false;

/**
 * Sends a Track Event to Pendo without waiting for it. Tracking never throws or slows a request down: a missing
 * key, a network failure or a non-2xx response is only logged.
 */
export function pendoTrack({ event, visitorId, accountId, properties = {} }: TrackEvent): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events are skipped");
    }
    return;
  }
  const host = process.env.PENDO_DATA_HOST || DEFAULT_PENDO_DATA_HOST;
  try {
    fetch(`https://${host}/data/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
      body: JSON.stringify({ type: "track", event, visitorId, accountId, timestamp: Date.now(), properties }),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Pendo track event "${event}" failed with status ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        console.error(`Pendo track event "${event}" failed`, error);
      });
  } catch (error) {
    console.error(`Pendo track event "${event}" failed`, error);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from one ISO date ("2026-11-03") to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** Today as an ISO date, in UTC. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Shortens free text so a property stays well inside Pendo's size limits. */
export function truncate(value: string, maxLength = 100): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
