// Server-side Pendo Track Events, sent to Pendo's Track API (POST https://<data host>/data/track).
// The integration key is read from PENDO_TRACK_EVENT_SECRET and must never be committed. Without it, events are
// skipped. Tracking never throws and never blocks the response: a failed send is only logged.

const DEFAULT_DATA_HOST = "data.pendo-dev.pendo-dev.com";
const TIMEOUT_MS = 5000;

/** The Track Event names Pendo has registered. They must match Pendo's names exactly, case included. */
export const PendoTrackEvent = {
  AssistantReplyGenerated: "assistant_reply_generated",
  TripCreated: "trip_created",
  TeamMemberAdded: "team_member_added",
  TeamMemberRoleChanged: "team_member_role_changed",
  AccountCreated: "account_created",
  AccountPlanChanged: "account_plan_changed",
  SignInCompleted: "sign_in_completed",
} as const;

export type PendoTrackEventName = (typeof PendoTrackEvent)[keyof typeof PendoTrackEvent];

export type PendoTrackProperties = Record<string, string | number | boolean>;

let warnedMissingSecret = false;

/**
 * Sends a Track Event to Pendo for the visitor (user) and account, in the background. Returns at once; the
 * request never rejects, so callers don't need to await or catch it.
 */
export function trackPendoEvent(
  event: PendoTrackEventName,
  ids: { visitorId: string; accountId: string },
  properties: PendoTrackProperties = {},
): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET is not set, so Pendo Track Events are not sent");
    }
    return;
  }
  const dataHost = process.env.PENDO_DATA_HOST || DEFAULT_DATA_HOST;
  void fetch(`https://${dataHost}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
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
        console.error(`Pendo Track Event ${event} was rejected with HTTP ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo Track Event ${event} could not be sent:`, error);
    });
}
