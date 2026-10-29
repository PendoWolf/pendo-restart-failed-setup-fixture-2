// Server-side Pendo Track Events. The routes call trackPendoEvent once an outcome is known on the server
// (a sign-in that succeeded, a trip that was saved, an assistant reply that came back), which the web app's
// clicks and page views can't tell apart from failures.
//
// The integration key comes from PENDO_TRACK_EVENT_SECRET and is never committed. Without it, events are
// skipped. Tracking never blocks or fails a request: the POST runs in the background and errors are only logged.

const DEFAULT_DATA_HOST = "data.pendo-dev.pendo-dev.com";
const REQUEST_TIMEOUT_MS = 5000;

/** Property values Pendo accepts on a Track Event. */
export type PendoPropertyValue = string | number | boolean;

export interface PendoTrackEvent {
  /** The Pendo track type's name, exactly as registered in Pendo. */
  event: string;
  /** The signed-in user's id. */
  visitorId: string;
  /** The signed-in user's account id. */
  accountId: string;
  properties?: Record<string, PendoPropertyValue>;
}

let warnedMissingSecret = false;

/** Sends a Track Event to Pendo in the background. Never throws, and never waits on Pendo. */
export function trackPendoEvent({ event, visitorId, accountId, properties = {} }: PendoTrackEvent): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET is not set, so Pendo Track Events are skipped");
    }
    return;
  }
  const dataHost = process.env.PENDO_DATA_HOST || DEFAULT_DATA_HOST;
  try {
    fetch(`https://${dataHost}/data/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
      body: JSON.stringify({ type: "track", event, visitorId, accountId, timestamp: Date.now(), properties }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

/** Cuts a user-supplied string down so the event's properties stay inside Pendo's size limit. */
export function truncateForPendo(value: string, maxLength = 100): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from one ISO date ("2026-11-03") to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** Today's date in UTC, as an ISO date like "2026-11-03". */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
