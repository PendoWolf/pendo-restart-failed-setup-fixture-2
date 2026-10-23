// Server-side Pendo Track Events, sent to Pendo's Track API (POST https://<data host>/data/track).
// Tracking never blocks or breaks a request: events are sent in the background, and a failure is only logged.

/** Pendo's data host, for the Track API. */
const PENDO_DATA_HOST = process.env.PENDO_DATA_HOST || "data.pendo-dev.pendo-dev.com";
/** The Pendo track event secret (integration key). Without it, no events are sent. */
const PENDO_TRACK_EVENT_SECRET = process.env.PENDO_TRACK_EVENT_SECRET;

/** Used for visitorId or accountId only when an event truly has no user or account behind it. */
export const SYSTEM_ID = "system";

/** A Track Event's properties: flat, with names made of letters, numbers and underscores. */
export type TrackProperties = Record<string, string | number | boolean>;

export interface TrackEvent {
  /** The visitor (user) id the event belongs to. */
  visitorId: string;
  /** The account id the event belongs to. */
  accountId: string;
  properties?: TrackProperties;
}

let warnedMissingSecret = false;

/** Sends a Track Event to Pendo in the background. Never throws. */
export function trackEvent(event: string, { visitorId, accountId, properties = {} }: TrackEvent): void {
  if (!PENDO_TRACK_EVENT_SECRET) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events aren't sent");
    }
    return;
  }
  try {
    fetch(`https://${PENDO_DATA_HOST}/data/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pendo-integration-key": PENDO_TRACK_EVENT_SECRET,
      },
      body: JSON.stringify({ type: "track", event, visitorId, accountId, timestamp: Date.now(), properties }),
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
