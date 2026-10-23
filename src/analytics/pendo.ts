/** A property value Pendo accepts on a Track Event. */
export type TrackPropertyValue = string | number | boolean | string[];

export interface TrackEvent {
  /** The Pendo track type, sent exactly as given. */
  event: string;
  /** The user who did it. */
  visitorId: string;
  /** Their account (company). */
  accountId: string;
  properties?: Record<string, TrackPropertyValue>;
}

// Server-side Pendo Track Events. The integration key is a secret, so it comes only from the environment; with no
// key set, tracking is off and nothing is sent.
const DATA_HOST = process.env.PENDO_DATA_HOST || "data.pendo-dev.pendo-dev.com";
const INTEGRATION_KEY = process.env.PENDO_TRACK_EVENT_SECRET;

/**
 * Sends a Track Event to Pendo without waiting for it. A tracking failure is logged and never reaches the request
 * that fired it.
 */
export function trackEvent({ event, visitorId, accountId, properties = {} }: TrackEvent): void {
  if (!INTEGRATION_KEY) return;
  fetch(`https://${DATA_HOST}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": INTEGRATION_KEY },
    body: JSON.stringify({ type: "track", event, visitorId, accountId, timestamp: Date.now(), properties }),
    signal: AbortSignal.timeout(5000),
  })
    .then((response) => {
      if (!response.ok) console.error(`Pendo track "${event}" failed with ${response.status}`);
    })
    .catch((error: unknown) => {
      console.error(`Pendo track "${event}" failed`, error);
    });
}
