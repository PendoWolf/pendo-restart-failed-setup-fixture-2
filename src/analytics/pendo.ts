// Server-side Pendo Track Events. Outcomes only the API knows (a sign-in that worked, a trip that was saved, a
// plan that changed) are sent to Pendo's Track API, so the web app's Feature clicks can be paired with what
// actually happened. Tracking never blocks or breaks a request: it's sent in the background, and a failure
// is only logged.

/** Pendo's data host. Override with PENDO_DATA_HOST. */
const DATA_HOST = process.env.PENDO_DATA_HOST || "data.pendo-dev.pendo-dev.com";
/** The Track Event integration key. Tracking is off until PENDO_TRACK_EVENT_SECRET is set. */
const TRACK_EVENT_SECRET = process.env.PENDO_TRACK_EVENT_SECRET;

export type TrackPropertyValue = string | number | boolean | string[];

/** Who did it: the Pendo visitor (user id) and account the event belongs to. */
export interface TrackIdentity {
  visitorId: string;
  accountId: string;
}

let warnedMissingSecret = false;

/** Days from `from` to `to`, both ISO dates such as "2026-11-03". */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** Today's date, as an ISO date such as "2026-11-03". */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Cuts free-text values short, so the event's properties stay under Pendo's size limit. */
export function truncate(value: string, maxLength = 100): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * Sends a Track Event to Pendo in the background. Leaves out properties that are undefined. Never throws, and
 * never delays the response.
 */
export function trackEvent(
  event: string,
  identity: TrackIdentity,
  properties: Record<string, TrackPropertyValue | undefined> = {},
): void {
  if (!TRACK_EVENT_SECRET) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events are off");
    }
    return;
  }
  const definedProperties = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );
  void fetch(`https://${DATA_HOST}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": TRACK_EVENT_SECRET },
    body: JSON.stringify({
      type: "track",
      event,
      visitorId: identity.visitorId,
      accountId: identity.accountId,
      timestamp: Date.now(),
      properties: definedProperties,
    }),
    signal: AbortSignal.timeout(5000),
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`Pendo Track Event "${event}" was rejected with status ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo Track Event "${event}" couldn't be sent`, error);
    });
}
