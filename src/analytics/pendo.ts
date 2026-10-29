// Server-side Pendo Track Events, sent to Pendo's Track API. The integration key is a secret, so it's read from
// PENDO_TRACK_EVENT_SECRET and never committed. Without it, events are skipped.

/** Pendo's data host. PENDO_DATA_HOST overrides it. */
const DEFAULT_DATA_HOST = "data.pendo-dev.pendo-dev.com";

/** How long one track request may take before it's abandoned. */
const TRACK_TIMEOUT_MS = 5000;

export type TrackPropertyValue = string | number | boolean | string[];

export interface TrackEvent {
  /** The signed-in user who caused the event. */
  visitorId: string;
  /** The account (company) of the signed-in user. */
  accountId: string;
  properties?: Record<string, TrackPropertyValue>;
}

let warnedMissingSecret = false;

/**
 * Sends a Track Event to Pendo in the background. It never throws or rejects: tracking failures are logged and
 * never break the request that caused the event.
 */
export function trackEvent(event: string, { visitorId, accountId, properties = {} }: TrackEvent): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events are skipped");
    }
    return;
  }
  const dataHost = process.env.PENDO_DATA_HOST || DEFAULT_DATA_HOST;
  fetch(`https://${dataHost}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
    body: JSON.stringify({ type: "track", event, visitorId, accountId, timestamp: Date.now(), properties }),
    signal: AbortSignal.timeout(TRACK_TIMEOUT_MS),
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`Pendo Track Event "${event}" failed with HTTP ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo Track Event "${event}" failed`, error);
    });
}
