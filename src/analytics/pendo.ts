// Sends Pendo Track Events from the API through Pendo's server-side Track API. The events are outcomes only
// the API knows (a sign-in's result, a saved trip, the assistant's reply), which a click in the web app can't show.

/** The Pendo data host that receives Track Events. */
const PENDO_DATA_HOST = process.env.PENDO_DATA_HOST ?? "data.pendo-dev.pendo-dev.com";
/** Gives up on a Track Event that takes longer than this, so tracking never holds anything up. */
const TRACK_TIMEOUT_MS = 5000;

export type TrackPropertyValue = string | number | boolean;

export interface TrackEvent {
  /** The signed-in user's id, or "system" only when there is truly no user. */
  visitorId: string;
  /** The user's account id, or "system" only when there is truly no account. */
  accountId: string;
  properties?: Record<string, TrackPropertyValue | undefined>;
}

let warnedMissingKey = false;

/**
 * Sends a Pendo Track Event without waiting for it. It never throws and never fails the request: a missing
 * key or a failed send is logged and the event is dropped.
 */
export function trackPendoEvent(event: string, { visitorId, accountId, properties = {} }: TrackEvent): void {
  // The Track Event secret is a credential: it comes from the environment, never from the code.
  const integrationKey = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!integrationKey) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events aren't sent");
    }
    return;
  }
  const body = JSON.stringify({
    type: "track",
    event,
    visitorId,
    accountId,
    timestamp: Date.now(),
    // JSON.stringify leaves out undefined properties.
    properties,
  });
  fetch(`https://${PENDO_DATA_HOST}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": integrationKey },
    body,
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

/** Cuts free text, such as a destination, down to a length that keeps the event's properties small. */
export function truncate(value: string, maxLength = 100): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
