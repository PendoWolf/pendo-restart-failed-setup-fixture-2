// Sends server-side Track Events to Pendo through its Track API (POST https://<data host>/data/track).
// The integration key is a secret, so it's read from PENDO_TRACK_EVENT_SECRET and never kept in the repo.
// Without it, tracking is switched off and the API works as before.

/** Pendo's data host for this environment. */
const PENDO_DATA_HOST = process.env.PENDO_DATA_HOST || "data.pendo-dev.pendo-dev.com";
/** How long a Track API request may take before it's abandoned. */
const TRACK_TIMEOUT_MS = 5000;

export type TrackPropertyValue = string | number | boolean | null;

export interface PendoTrackEvent {
  /** The event name, exactly as Pendo has it registered. */
  event: string;
  /** The id of the signed-in user who caused the event. */
  visitorId: string;
  /** The id of that user's account. */
  accountId: string;
  properties?: Record<string, TrackPropertyValue>;
}

let warnedMissingSecret = false;

/** Cuts free text (destinations, ids from request bodies) down so it fits Pendo's property limits. */
export function truncate(value: string, maxLength = 100): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * Sends a Track Event to Pendo without waiting for it: tracking never slows down or breaks a request, and a
 * failure is only logged.
 */
export function trackPendoEvent({ event, visitorId, accountId, properties = {} }: PendoTrackEvent): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events are switched off");
    }
    return;
  }
  try {
    const body = { type: "track", event, visitorId, accountId, timestamp: Date.now(), properties };
    void fetch(`https://${PENDO_DATA_HOST}/data/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TRACK_TIMEOUT_MS),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Pendo Track Event "${event}" was rejected with status ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        console.error(`Pendo Track Event "${event}" couldn't be sent`, error);
      });
  } catch (error) {
    console.error(`Pendo Track Event "${event}" couldn't be sent`, error);
  }
}
