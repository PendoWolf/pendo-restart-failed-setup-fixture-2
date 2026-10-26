// Sends Track Events to Pendo's server-side Track API (POST https://<data host>/data/track), for outcomes that
// only the API knows about, such as a sign-in that worked or an assistant reply that came back.
//
// The integration key is read from PENDO_TRACK_EVENT_SECRET and never committed. When it isn't set, events are
// skipped, so local development and tests don't need it.

/** The Track Events the API sends. Pendo matches on these names exactly, so never reword them. */
export type TrackEventName =
  | "assistant_reply_generated"
  | "assistant_reply_failed"
  | "trip_created"
  | "user_signed_in"
  | "account_plan_changed"
  | "account_created"
  | "team_member_added"
  | "user_role_changed";

export type TrackEventProperties = Record<string, string | number | boolean>;

/** Who the event is about: the Pendo visitor (a user's id) and account (their account's id). */
export interface TrackEventIdentity {
  visitorId: string;
  accountId: string;
}

const DEFAULT_DATA_HOST = "data.pendo-dev.pendo-dev.com";
const REQUEST_TIMEOUT_MS = 5000;

let warnedMissingSecret = false;

async function sendTrackEvent(
  secret: string,
  event: TrackEventName,
  identity: TrackEventIdentity,
  properties: TrackEventProperties,
): Promise<void> {
  const dataHost = process.env.PENDO_DATA_HOST || DEFAULT_DATA_HOST;
  const response = await fetch(`https://${dataHost}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
    body: JSON.stringify({
      type: "track",
      event,
      visitorId: identity.visitorId,
      accountId: identity.accountId,
      timestamp: Date.now(),
      properties,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Pendo Track API answered ${response.status}`);
  }
}

/**
 * Sends a Track Event to Pendo in the background. It never throws and never delays the response: a failed
 * send is only logged.
 */
export function trackEvent(
  event: TrackEventName,
  identity: TrackEventIdentity,
  properties: TrackEventProperties,
): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events are skipped");
    }
    return;
  }
  sendTrackEvent(secret, event, identity, properties).catch((error: unknown) => {
    console.error(`Couldn't send the Pendo Track Event ${event}:`, error);
  });
}

/** Cuts a string property down to `max` characters, to stay inside Pendo's 512-byte properties limit. */
export function truncate(value: string, max = 100): string {
  return value.length > max ? value.slice(0, max) : value;
}
