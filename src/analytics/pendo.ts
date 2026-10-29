// Server-side Pendo Track Events, sent to Pendo's /data/track endpoint.
// The integration key is a secret, so it comes from PENDO_TRACK_EVENT_SECRET and is never committed.
// Without it, events are skipped and the API works as usual.

const DEFAULT_DATA_HOST = "data.pendo-dev.pendo-dev.com";

/** Property values Pendo accepts on a Track Event. */
export type TrackProperty = string | number | boolean;

export interface TrackEvent {
  /** The Pendo track type's exact name. */
  event: string;
  /** The signed-in user who did it. */
  visitorId: string;
  /** The signed-in user's account. */
  accountId: string;
  properties?: Record<string, TrackProperty | undefined>;
}

let warnedMissingSecret = false;

/** Shortens free text so the event's properties stay under Pendo's 512-byte limit. */
export function truncate(value: string, maxLength = 100): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * Sends a Track Event to Pendo without waiting for it. Tracking failures are logged and never reach the
 * request that caused them.
 */
export function trackEvent({ event, visitorId, accountId, properties = {} }: TrackEvent): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events are skipped");
    }
    return;
  }
  const dataHost = process.env.PENDO_DATA_HOST || DEFAULT_DATA_HOST;
  const definedProperties = Object.fromEntries(
    Object.entries(properties).filter((entry): entry is [string, TrackProperty] => entry[1] !== undefined),
  );
  try {
    fetch(`https://${dataHost}/data/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
      body: JSON.stringify({
        type: "track",
        event,
        visitorId,
        accountId,
        timestamp: Date.now(),
        properties: definedProperties,
      }),
      signal: AbortSignal.timeout(5000),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Pendo track "${event}" failed with status ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        console.error(`Pendo track "${event}" failed`, error);
      });
  } catch (error) {
    console.error(`Pendo track "${event}" failed`, error);
  }
}
