// Server-side Pendo Track Events, sent to Pendo's Track API. They record outcomes only the API knows about, such
// as a trip that was actually saved, rather than the click that asked for it.

/** The Track Event names Pendo has registered. Pendo matches on these exactly, so never reword them. */
export type PendoTrackEventName =
  | "assistant_reply_generated"
  | "trip_created"
  | "trip_updated"
  | "user_signed_in"
  | "team_member_added"
  | "user_role_changed"
  | "account_plan_changed"
  | "account_created";

export type PendoTrackProperties = Record<string, string | number | boolean>;

/** Who the event is about: the signed-in user and their account. */
export interface PendoTrackIdentity {
  visitorId: string;
  accountId: string;
}

const DEFAULT_PENDO_DATA_HOST = "data.pendo-dev.pendo-dev.com";
const TRACK_TIMEOUT_MS = 5000;

let warnedMissingSecret = false;

/**
 * Sends a Track Event to Pendo in the background. It never throws and never delays the response: a missing
 * PENDO_TRACK_EVENT_SECRET skips the event, and a failed request is only logged.
 */
export function trackPendoEvent(
  event: PendoTrackEventName,
  identity: PendoTrackIdentity,
  properties: PendoTrackProperties = {},
): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events are skipped");
    }
    return;
  }
  const host = process.env.PENDO_DATA_HOST || DEFAULT_PENDO_DATA_HOST;
  try {
    fetch(`https://${host}/data/track`, {
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
      signal: AbortSignal.timeout(TRACK_TIMEOUT_MS),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Pendo Track Event ${event} was rejected with status ${response.status}`);
        }
      })
      .catch((failure: unknown) => {
        console.error(`Pendo Track Event ${event} couldn't be sent`, failure);
      });
  } catch (failure) {
    console.error(`Pendo Track Event ${event} couldn't be sent`, failure);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from one ISO date ("2026-11-03") to another; negative when `to` comes first. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** Today's date in UTC, as an ISO date like "2026-11-03". */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
