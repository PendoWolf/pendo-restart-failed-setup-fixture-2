/** A value Pendo accepts for a Track Event property. */
export type TrackPropertyValue = string | number | boolean | string[];

export interface TrackEventInput {
  /** The id of the user who caused the event, or "system" when there's truly no user. */
  visitorId: string;
  /** The id of that user's account, or "system" when there's truly no account. */
  accountId: string;
  properties?: Record<string, TrackPropertyValue>;
}

// Pendo's server-side Track Event API. The integration key is a secret, so it only ever comes from the
// environment: with no PENDO_TRACK_EVENT_SECRET set, events are skipped.
const PENDO_DATA_HOST = process.env.PENDO_DATA_HOST ?? "data.pendo-dev.pendo-dev.com";
const PENDO_TRACK_EVENT_SECRET = process.env.PENDO_TRACK_EVENT_SECRET;
const PENDO_TRACK_TIMEOUT_MS = 5000;

/** Longest string property value sent, so the properties stay within Pendo's size limit. */
const MAX_STRING_LENGTH = 100;

/** Cuts a string property value down to MAX_STRING_LENGTH characters. */
export function trackString(value: string): string {
  return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;
}

/**
 * Sends a Track Event to Pendo in the background. Never throws and never delays the response: a tracking
 * failure is only logged.
 */
export function trackPendoEvent(event: string, { visitorId, accountId, properties = {} }: TrackEventInput): void {
  if (!PENDO_TRACK_EVENT_SECRET) return;
  try {
    fetch(`https://${PENDO_DATA_HOST}/data/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pendo-integration-key": PENDO_TRACK_EVENT_SECRET,
      },
      body: JSON.stringify({ type: "track", event, visitorId, accountId, timestamp: Date.now(), properties }),
      signal: AbortSignal.timeout(PENDO_TRACK_TIMEOUT_MS),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Pendo Track Event "${event}" was rejected with status ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        console.error(`Pendo Track Event "${event}" failed`, error);
      });
  } catch (error) {
    console.error(`Pendo Track Event "${event}" failed`, error);
  }
}
