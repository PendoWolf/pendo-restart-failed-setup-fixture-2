// Server-side Pendo Track Events, sent to Pendo's Track API (POST https://<data host>/data/track).
// The integration key is read from PENDO_TRACK_EVENT_SECRET; when it isn't set, events are skipped.

/** The Track Events the API sends. Pendo matches on these names exactly, so never reword them. */
export type PendoTrackEvent =
  | "assistant_reply_generated"
  | "trip_created"
  | "account_plan_changed"
  | "account_created"
  | "team_member_added"
  | "user_role_changed";

export type PendoTrackProperties = Record<string, string | number | boolean>;

const DEFAULT_DATA_HOST = "data.pendo-dev.pendo-dev.com";
const TIMEOUT_MS = 5000;

let warnedMissingKey = false;

/**
 * Sends a Track Event to Pendo for the visitor (user) and account it happened for. Fire-and-forget: it never
 * throws and never delays the response, so a tracking failure can't break the request that caused it.
 */
export function trackPendoEvent(
  event: PendoTrackEvent,
  ids: { visitorId: string; accountId: string },
  properties: PendoTrackProperties = {},
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
        visitorId: ids.visitorId || "system",
        accountId: ids.accountId || "system",
        timestamp: Date.now(),
        properties,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Pendo Track Event "${event}" was rejected with status ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        console.error(`Pendo Track Event "${event}" failed to send`, error);
      });
  } catch (error) {
    console.error(`Pendo Track Event "${event}" failed to send`, error);
  }
}
