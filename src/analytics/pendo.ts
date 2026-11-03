import type { Request } from "express";

// Server-side Pendo Track Events, sent to Pendo's Track API (POST /data/track). The integration key is a
// secret, so it's read from PENDO_TRACK_EVENT_SECRET and never committed; without it, events are skipped.
const PENDO_DATA_HOST = process.env.PENDO_DATA_HOST ?? "data.pendo-dev.pendo-dev.com";
const PENDO_TRACK_TIMEOUT_MS = 5000;

/** A Track Event property value Pendo accepts. Keep the properties JSON under 512 bytes. */
export type PendoPropertyValue = string | number | boolean | string[];

export interface PendoTrackEvent {
  /** The Pendo track type's name, exactly as it's registered in Pendo. */
  event: string;
  /** The user behind the event, or "system" when there truly is none. */
  visitorId: string;
  /** The user's account, or "system" when there truly is none. */
  accountId: string;
  properties?: Record<string, PendoPropertyValue>;
  /** The request the event came from, for the event's user agent and URL. */
  req?: Request;
}

let warnedMissingSecret = false;

/**
 * Sends a Track Event to Pendo without waiting for it. Tracking never breaks the request: a missing key
 * skips the event, and a failed send is only logged.
 */
export function trackPendoEvent({ event, visitorId, accountId, properties = {}, req }: PendoTrackEvent): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events are skipped");
    }
    return;
  }
  const userAgent = req?.header("user-agent");
  const body = {
    type: "track",
    event,
    visitorId,
    accountId,
    timestamp: Date.now(),
    properties,
    ...(req && { context: { ...(userAgent && { userAgent }), url: req.originalUrl } }),
  };
  fetch(`https://${PENDO_DATA_HOST}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PENDO_TRACK_TIMEOUT_MS),
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`Pendo Track Event "${event}" was rejected with status ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo Track Event "${event}" couldn't be sent`, error);
    });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from ISO date `from` to ISO date `to`, such as 5 from "2026-11-03" to "2026-11-08". */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** Today's ISO date, in UTC. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
