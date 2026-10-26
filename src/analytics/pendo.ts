/**
 * Server-side Pendo Track Events, sent to Pendo's Track API (POST https://<data host>/data/track).
 *
 * The integration key is a secret: it's read from PENDO_TRACK_EVENT_SECRET and never committed. Without it,
 * events are skipped. Tracking never blocks or breaks a request: events are sent in the background, and a failed
 * send is only logged.
 */

/** A property value Pendo accepts on a Track Event. */
export type TrackPropertyValue = string | number | boolean | null;

export interface TrackEvent {
  /** The event name, exactly as Pendo has it registered. */
  event: string;
  /** The user the event is about, or "system" when there's none (such as a failed sign-in). */
  visitorId: string;
  /** The visitor's account, or "system" when there's none. */
  accountId: string;
  properties?: Record<string, TrackPropertyValue | undefined>;
}

const DEFAULT_DATA_HOST = "data.pendo-dev.pendo-dev.com";
const SEND_TIMEOUT_MS = 5000;

let warnedMissingSecret = false;

/** Sends a Track Event to Pendo in the background. Never throws. */
export function trackEvent({ event, visitorId, accountId, properties = {} }: TrackEvent): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events are skipped");
    }
    return;
  }
  const dataHost = process.env.PENDO_DATA_HOST || DEFAULT_DATA_HOST;
  const definedProperties = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );
  void fetch(`https://${dataHost}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
    body: JSON.stringify({
      type: "track",
      event,
      visitorId,
      accountId,
      timestamp: Date.now(),
      properties: definedProperties,
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
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

/** Cuts a string property down so the event's properties stay well under Pendo's 512-byte limit. */
export function truncate(value: string, maxLength = 100): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from one ISO date ("2026-11-03") to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** Today's date in UTC, as an ISO date ("2026-11-03"). */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
