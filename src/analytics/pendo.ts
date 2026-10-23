// Server-side Pendo Track Events, sent through Pendo's Track Events API (POST /data/track).
// The integration key is a secret: it comes from PENDO_TRACK_EVENT_SECRET and is never committed. Without it,
// tracking is a no-op, so local development works without a Pendo setup.

/** Where Track Events go: Pendo's data host. */
const PENDO_DATA_HOST = process.env.PENDO_DATA_HOST ?? "data.pendo-dev.pendo-dev.com";
const PENDO_TRACK_EVENT_SECRET = process.env.PENDO_TRACK_EVENT_SECRET;

/** How long a Track Event request may take before it's given up on. */
const TRACK_TIMEOUT_MS = 5000;

/** The Track Events this API sends. The names match the track types registered in Pendo exactly. */
export type PendoTrackEventName =
  | "trip_created"
  | "trip_updated"
  | "assistant_reply_generated"
  | "user_signed_in"
  | "user_created"
  | "user_role_changed"
  | "account_created"
  | "account_plan_changed";

export type PendoTrackPropertyValue = string | number | boolean | string[] | null;

/** Who the event belongs to: the signed-in user's id and their account's id. */
export interface PendoTrackIdentity {
  visitorId: string;
  accountId: string;
}

let warnedMissingSecret = false;

/**
 * Sends a Track Event to Pendo in the background. It never throws and never delays the response: a failed or
 * slow request is only logged.
 */
export function trackPendoEvent(
  event: PendoTrackEventName,
  identity: PendoTrackIdentity,
  properties: Record<string, PendoTrackPropertyValue> = {},
): void {
  if (!PENDO_TRACK_EVENT_SECRET) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events are not sent");
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
      body: JSON.stringify({
        type: "track",
        event,
        visitorId: identity.visitorId,
        accountId: identity.accountId,
        timestamp: Date.now(),
        properties,
      }),
      signal: AbortSignal.timeout(TRACK_TIMEOUT_MS),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Pendo Track Event ${event} failed with status ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        console.error(`Pendo Track Event ${event} failed`, error);
      });
  } catch (error) {
    console.error(`Pendo Track Event ${event} failed`, error);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from ISO date `from` to ISO date `to` (such as "2026-11-03"); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** Today's date in UTC, as an ISO date such as "2026-11-03". */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
