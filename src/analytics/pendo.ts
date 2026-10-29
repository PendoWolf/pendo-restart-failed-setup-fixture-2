// Server-side Pendo Track Events, sent to Pendo's Track API (POST https://<data host>/data/track).
// The integration key is a secret: it's read from PENDO_TRACK_EVENT_SECRET and never committed. Without it,
// events aren't sent. Tracking never throws and never holds up a response.

const PENDO_DATA_HOST = process.env.PENDO_DATA_HOST ?? "data.pendo-dev.pendo-dev.com";
const PENDO_TRACK_EVENT_SECRET = process.env.PENDO_TRACK_EVENT_SECRET;
const TRACK_TIMEOUT_MS = 5000;

export type TrackPropertyValue = string | number | boolean | string[];

/** Who did it: the Pendo visitor (the user's id) and account (the account's id). */
export interface TrackIdentity {
  visitorId: string;
  accountId: string;
}

let warnedMissingSecret = false;

/** Sends a Track Event to Pendo in the background. Failures are logged, never thrown. */
export function trackPendoEvent(
  event: string,
  identity: TrackIdentity,
  properties: Record<string, TrackPropertyValue> = {},
): void {
  if (!PENDO_TRACK_EVENT_SECRET) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events aren't sent");
    }
    return;
  }
  const body = {
    type: "track",
    event,
    visitorId: identity.visitorId,
    accountId: identity.accountId,
    timestamp: Date.now(),
    properties,
  };
  fetch(`https://${PENDO_DATA_HOST}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": PENDO_TRACK_EVENT_SECRET },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TRACK_TIMEOUT_MS),
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

/** Cuts a string property down so the event stays within Pendo's property size limits. */
export function truncateProperty(value: string, maxLength = 100): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
