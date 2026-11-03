// Sends Pendo Track Events from the API through Pendo's server-side Track API. These events cover outcomes only
// the API knows about (a sign-in that was accepted, a trip that was saved, an assistant reply), so they can't be
// captured as Pages or Features in the web app.
//
// The integration key is a secret: it's read from PENDO_TRACK_EVENT_SECRET and never committed. Without it the
// events are skipped, so local development works unchanged.

const DATA_HOST = process.env.PENDO_DATA_HOST ?? "data.pendo-dev.pendo-dev.com";
const TRACK_TIMEOUT_MS = 5000;
/** Longest string property sent, to keep each event's properties well under Pendo's 512-byte limit. */
const MAX_STRING_LENGTH = 100;

export type TrackPropertyValue = string | number | boolean | string[];
export type TrackProperties = Record<string, TrackPropertyValue>;

/** Who an event belongs to: the Pendo visitor (a user's id) and account (their account's id). */
export interface TrackIdentity {
  visitorId: string;
  accountId: string;
}

function trimmed(properties: TrackProperties): TrackProperties {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      typeof value === "string" ? value.slice(0, MAX_STRING_LENGTH) : value,
    ]),
  );
}

async function send(event: string, identity: TrackIdentity, properties: TrackProperties, key: string) {
  const response = await fetch(`https://${DATA_HOST}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": key },
    body: JSON.stringify({
      type: "track",
      event,
      visitorId: identity.visitorId,
      accountId: identity.accountId,
      timestamp: Date.now(),
      properties: trimmed(properties),
    }),
    signal: AbortSignal.timeout(TRACK_TIMEOUT_MS),
  });
  if (!response.ok) {
    console.error(`Pendo track event "${event}" was rejected with status ${response.status}`);
  }
}

/**
 * Sends a Pendo Track Event in the background. It never throws and never delays the response: a failure is only
 * logged, so tracking can't break the request it describes.
 */
export function trackEvent(event: string, identity: TrackIdentity, properties: TrackProperties = {}): void {
  const key = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!key) return;
  send(event, identity, properties, key).catch((error: unknown) => {
    console.error(`Pendo track event "${event}" failed to send`, error);
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's date in UTC, like "2026-11-03", the same way the trip store compares dates. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole days from one ISO date to another (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}
