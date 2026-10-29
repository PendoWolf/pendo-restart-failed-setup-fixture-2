// Server-side Pendo Track Events: outcomes only the API knows about (a trip saved, a plan changed, an assistant
// reply that came back or failed), sent to Pendo's Track API. Tracking never blocks or breaks a request: events
// are sent in the background, and a failure is only logged.

/** The Track Events the API sends. Pendo matches on these names exactly, so never reword them. */
export const PENDO_EVENTS = {
  assistantReplyGenerated: "assistant_reply_generated",
  assistantReplyFailed: "assistant_reply_failed",
  tripCreated: "trip_created",
  tripUpdated: "trip_updated",
  teamMemberAdded: "team_member_added",
  userRoleChanged: "user_role_changed",
  accountPlanChanged: "account_plan_changed",
  accountCreated: "account_created",
} as const;

export type PendoEventName = (typeof PENDO_EVENTS)[keyof typeof PENDO_EVENTS];

export type PendoPropertyValue = string | number | boolean | string[];

const dataHost = process.env.PENDO_DATA_HOST ?? "data.pendo-dev.pendo-dev.com";
// The Track Event integration key is a secret: it comes from the environment, never from the code.
const integrationKey = process.env.PENDO_TRACK_EVENT_SECRET;

let warnedMissingKey = false;

/** Shortens a string property so the event stays inside Pendo's property size limits. */
export function clip(value: string, maxLength = 100): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * Sends a Track Event to Pendo for the signed-in visitor and their account. Returns at once: the request runs in
 * the background, and any failure is logged rather than thrown.
 */
export function trackPendoEvent(
  event: PendoEventName,
  ids: { visitorId: string; accountId: string },
  properties: Record<string, PendoPropertyValue> = {},
): void {
  if (!integrationKey) {
    if (!warnedMissingKey) {
      console.warn("PENDO_TRACK_EVENT_SECRET is not set, so Pendo Track Events are not sent");
      warnedMissingKey = true;
    }
    return;
  }
  const body = {
    type: "track",
    event,
    visitorId: ids.visitorId || "system",
    accountId: ids.accountId || "system",
    timestamp: Date.now(),
    properties,
  };
  fetch(`https://${dataHost}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": integrationKey },
    body: JSON.stringify(body),
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`Pendo Track Event ${event} was rejected with status ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo Track Event ${event} could not be sent`, error);
    });
}
