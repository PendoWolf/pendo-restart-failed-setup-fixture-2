import type { Account, User } from "../types.js";

/**
 * The Track Events the API sends to Pendo, for outcomes only the API sees, such as a trip that was actually saved.
 * Pendo matches each event by its exact name, so renaming one starts a new event in Pendo instead of continuing it.
 */
export type TrackEventName =
  | "trip_created"
  | "assistant_reply_generated"
  | "assistant_reply_failed"
  | "user_signed_in"
  | "user_created"
  | "user_role_changed"
  | "account_created"
  | "account_plan_changed"
  | "account_deleted";

/**
 * A Track Event's properties, leaving out undefined ones. Never put emails, passwords, tokens or chat messages here.
 */
export type TrackProperties = Record<string, string | number | boolean | null | undefined>;

// Where Track Events go when PENDO_DATA_HOST isn't set.
const DEFAULT_DATA_HOST = "data.pendo-dev.pendo-dev.com";
// Pendo takes at most 512 bytes of properties per event, so long text, such as a destination, is cut short.
const MAX_TEXT_LENGTH = 100;
// How long to wait for Pendo before giving up on the event, so a slow Pendo can't pile up open requests.
const TIMEOUT_MS = 5000;

let warnedNoSecret = false;

/**
 * Sends a Track Event to Pendo's Track Event API, with the signed-in user as the Pendo visitor and their account as
 * the Pendo account. It runs in the background, so it never fails or holds up the request that sends it: when Pendo
 * can't take the event, it only logs why. It sends nothing while PENDO_TRACK_EVENT_SECRET isn't set.
 */
export function trackEvent(
  event: TrackEventName,
  signedIn: { user: User; account: Account },
  properties: TrackProperties,
): void {
  send(event, signedIn, properties).catch((error: unknown) => {
    console.error(`Couldn't send the Pendo Track Event "${event}":`, error);
  });
}

async function send(
  event: TrackEventName,
  { user, account }: { user: User; account: Account },
  properties: TrackProperties,
): Promise<void> {
  const timestamp = Date.now();
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so the API sends no Pendo Track Events");
    }
    return;
  }
  const response = await fetch(`https://${process.env.PENDO_DATA_HOST || DEFAULT_DATA_HOST}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
    body: JSON.stringify({
      type: "track",
      event,
      visitorId: user.id,
      accountId: account.id,
      timestamp,
      properties: Object.fromEntries(
        Object.entries(properties).map(([name, value]) => [
          name,
          typeof value === "string" ? value.slice(0, MAX_TEXT_LENGTH) : value,
        ]),
      ),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // Pendo's answer has nothing the API needs, so let the connection go.
  await response.body?.cancel();
  if (!response.ok) {
    throw new Error(`Pendo answered with status ${response.status}`);
  }
}
