// Sends Track Events to Pendo's server-side Track API, for outcomes only the API knows (a trip was really saved,
// a sign-in succeeded, the assistant answered). The integration key comes from PENDO_TRACK_EVENT_SECRET; with no
// key set, events are skipped so local development works without Pendo.

const DEFAULT_DATA_HOST = "data.pendo-dev.pendo-dev.com";

/** A Track Event property value. Keep properties small: Pendo caps the properties JSON at 512 bytes. */
export type PendoPropertyValue = string | number | boolean;

/** Who the event belongs to: the signed-in user and their account. */
export interface PendoTrackIdentity {
  visitorId: string;
  accountId: string;
}

let warnedMissingKey = false;

/**
 * Sends one Track Event to Pendo without waiting for it. Tracking never throws and never slows down the
 * response: failures are only logged.
 */
export function trackPendoEvent(
  event: string,
  identity: PendoTrackIdentity,
  properties: Record<string, PendoPropertyValue> = {},
): void {
  const integrationKey = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!integrationKey) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events are skipped");
    }
    return;
  }
  const dataHost = process.env.PENDO_DATA_HOST || DEFAULT_DATA_HOST;
  try {
    fetch(`https://${dataHost}/data/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pendo-integration-key": integrationKey },
      body: JSON.stringify({
        type: "track",
        event,
        visitorId: identity.visitorId,
        accountId: identity.accountId,
        timestamp: Date.now(),
        properties,
      }),
      signal: AbortSignal.timeout(5000),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Pendo Track Event "${event}" failed with status ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        console.error(`Pendo Track Event "${event}" failed`, error);
      });
  } catch (error) {
    console.error(`Pendo Track Event "${event}" failed`, error);
  }
}
