// Server-side Pendo Track Events. The API has no pages of its own, so outcomes only it knows (a trip that passed
// validation, a sign-in that succeeded, a plan that changed) are sent to Pendo's Track API from here.
//
// Configuration comes from the environment, never from the code:
// - PENDO_TRACK_EVENT_SECRET: the Pendo Track Event shared secret. Tracking is off when it's not set.
// - PENDO_DATA_HOST: the Pendo data host, such as data.pendo.io.

/** A Track Event property value Pendo accepts. */
export type TrackPropertyValue = string | number | boolean;

export interface TrackEvent {
  /** The event name, exactly as Pendo registered it. */
  event: string;
  /** The signed-in user's id, or "system" when there's no user. */
  visitorId: string;
  /** The id of the account the event belongs to, or "system" when there's none. */
  accountId: string;
  properties?: Record<string, TrackPropertyValue>;
}

const DEFAULT_DATA_HOST = "data.pendo-dev.pendo-dev.com";
const REQUEST_TIMEOUT_MS = 5000;

let warnedNotConfigured = false;

/**
 * Sends a Track Event to Pendo without waiting for it: tracking failures are logged and never break the request
 * that triggered them.
 */
export function trackEvent({ event, visitorId, accountId, properties = {} }: TrackEvent): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    if (!warnedNotConfigured) {
      warnedNotConfigured = true;
      console.warn("Pendo Track Events are off: PENDO_TRACK_EVENT_SECRET isn't set");
    }
    return;
  }
  const dataHost = process.env.PENDO_DATA_HOST || DEFAULT_DATA_HOST;
  const body = JSON.stringify({ type: "track", event, visitorId, accountId, timestamp: Date.now(), properties });
  fetch(`https://${dataHost}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`Pendo Track Event "${event}" was rejected with HTTP ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo Track Event "${event}" couldn't be sent`, error);
    });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from one ISO date (such as "2026-11-03") to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** Today's date in UTC, as an ISO date. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
