import type { Request } from "express";

// Server-side Pendo Track Events, sent to Pendo's Track API (POST https://<data host>/data/track).
// The integration key is a secret, so it comes from the environment and is never committed. Without it,
// tracking is turned off and the API works as usual.
const PENDO_DATA_HOST = process.env.PENDO_DATA_HOST || "data.pendo-dev.pendo-dev.com";
const PENDO_TRACK_EVENT_SECRET = process.env.PENDO_TRACK_EVENT_SECRET;

/** How long to wait for Pendo before giving up on an event. */
const TRACK_TIMEOUT_MS = 5000;

export type TrackPropertyValue = string | number | boolean | string[] | null;

export interface TrackEvent {
  /** The event name, exactly as Pendo's track type is registered. */
  event: string;
  /** The signed-in user's id, or "system" when there's no user. */
  visitorId: string;
  /** The signed-in user's account id, or "system" when there's no account. */
  accountId: string;
  properties?: Record<string, TrackPropertyValue>;
  /** The request the event happened in, for its IP and user agent. */
  req?: Request;
}

let warnedMissingSecret = false;

/**
 * Sends a Track Event to Pendo in the background. It never throws and never delays the response: a failed
 * or slow request to Pendo is only logged.
 */
export function trackEvent({ event, visitorId, accountId, properties = {}, req }: TrackEvent): void {
  if (!PENDO_TRACK_EVENT_SECRET) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events are turned off");
    }
    return;
  }
  try {
    const body = {
      type: "track",
      event,
      visitorId,
      accountId,
      timestamp: Date.now(),
      properties,
      ...(req && { context: { ip: req.ip, userAgent: req.header("user-agent") } }),
    };
    fetch(`https://${PENDO_DATA_HOST}/data/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pendo-integration-key": PENDO_TRACK_EVENT_SECRET,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TRACK_TIMEOUT_MS),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Pendo Track Event "${event}" was rejected with status ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        console.error(`Pendo Track Event "${event}" failed to send`, error);
      });
  } catch (error) {
    console.error(`Pendo Track Event "${event}" failed to send`, error);
  }
}

/** Shortens a string property so the event stays within Pendo's size limits. */
export function truncate(value: string, maxLength = 100): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/** Whole days from one ISO date (such as "2026-11-03") to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** Today's date in UTC, such as "2026-11-03". */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
