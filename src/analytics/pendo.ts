/** A Track Event property value, as Pendo accepts it. */
export type TrackProperties = Record<string, string | number | boolean>;

/** Who a Track Event belongs to. Use "system" only when there's truly no signed-in user or account. */
export interface TrackIdentity {
  visitorId: string;
  accountId: string;
}

// The Pendo data host Track Events are sent to, and the Track Event integration key. The key is a secret:
// set it in the environment, never in the code. Without it, Track Events are skipped.
const dataHost = process.env.PENDO_DATA_HOST ?? "data.pendo-dev.pendo-dev.com";
const integrationKey = process.env.PENDO_TRACK_EVENT_SECRET;

/**
 * Sends a server-side Track Event to Pendo (POST /data/track). It never throws and never makes the caller
 * wait: a failure is only logged, so tracking can't break the request it describes.
 */
export function trackEvent(event: string, identity: TrackIdentity, properties: TrackProperties = {}): void {
  if (!integrationKey) return;
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
      if (!response.ok) console.error(`Pendo Track Event ${event} failed with status ${response.status}`);
    })
    .catch((error: unknown) => {
      console.error(`Pendo Track Event ${event} failed`, error);
    });
}
