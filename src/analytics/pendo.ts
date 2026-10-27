/** A Pendo Track Event property value. */
export type TrackProperty = string | number | boolean;

/** Who a Track Event belongs to: the Pendo visitor (user id) and account (account id). */
export interface TrackIdentity {
  visitorId: string;
  accountId: string;
}

// The Pendo data host Track Events are sent to, and the integration key that authorizes them. The key is a
// secret, so it only ever comes from the environment; without it, tracking is switched off.
const PENDO_DATA_HOST = process.env.PENDO_DATA_HOST ?? "data.pendo-dev.pendo-dev.com";
const PENDO_TRACK_EVENT_SECRET = process.env.PENDO_TRACK_EVENT_SECRET;

/** The identity for events that happen with no signed-in user. */
export const SYSTEM_IDENTITY: TrackIdentity = { visitorId: "system", accountId: "system" };

/** Cuts a free-text value down so the event's properties stay well under Pendo's 512-byte limit. */
export function clip(value: string, maxLength = 60): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * Sends a server-side Track Event to Pendo. It doesn't wait for Pendo and never throws: a tracking failure is
 * logged and the request carries on as if nothing happened.
 */
export function trackEvent(event: string, identity: TrackIdentity, properties: Record<string, TrackProperty>): void {
  if (!PENDO_TRACK_EVENT_SECRET) return;
  fetch(`https://${PENDO_DATA_HOST}/data/track`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pendo-integration-key": PENDO_TRACK_EVENT_SECRET,
    },
    body: JSON.stringify({
      type: "track",
      event,
      visitorId: identity.visitorId,
      accountId: identity.accountId,
      timestamp: Date.now(),
      properties,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`Pendo track event "${event}" was rejected with status ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo track event "${event}" failed to send`, error);
    });
}
