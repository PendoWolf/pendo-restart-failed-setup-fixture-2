// Server-side Pendo Track Events, sent through Pendo's Track Event API (POST https://<data host>/data/track).
// The API has no pages of its own, so outcomes only it knows about (a trip saved, a sign-in rejected, an
// assistant reply generated) are reported from here instead of with pendo.track() in a browser.

/** Host of Pendo's data API, set per environment. */
const PENDO_DATA_HOST = process.env.PENDO_DATA_HOST ?? "data.pendo-dev.pendo-dev.com";

/** Longest string property value sent to Pendo, so a property stays well under Pendo's size limits. */
const MAX_STRING_LENGTH = 100;

export type TrackPropertyValue = string | number | boolean | string[];

export interface TrackEventInput {
  /** The signed-in user's id, or a placeholder when the event has no signed-in user. */
  visitorId: string;
  /** The signed-in user's account id, or a placeholder when the event has no account. */
  accountId: string;
  properties?: Record<string, TrackPropertyValue | undefined>;
}

/** Drops undefined values and shortens long strings. */
function cleanProperties(
  properties: Record<string, TrackPropertyValue | undefined> = {},
): Record<string, TrackPropertyValue> {
  const cleaned: Record<string, TrackPropertyValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue;
    cleaned[key] = typeof value === "string" ? value.slice(0, MAX_STRING_LENGTH) : value;
  }
  return cleaned;
}

/**
 * Sends a Track Event to Pendo without waiting for it. Tracking never breaks the request: when the integration
 * key isn't configured the event is skipped, and a failed request is only logged.
 */
export function trackPendoEvent(event: string, { visitorId, accountId, properties }: TrackEventInput): void {
  const integrationKey = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!integrationKey) return;
  const body = {
    type: "track",
    event,
    visitorId,
    accountId,
    timestamp: Date.now(),
    properties: cleanProperties(properties),
  };
  fetch(`https://${PENDO_DATA_HOST}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": integrationKey },
    body: JSON.stringify(body),
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`Pendo track event "${event}" failed with status ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo track event "${event}" failed`, error);
    });
}

/** Today's date in UTC, such as "2026-11-03". */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole days from the ISO date `from` to the ISO date `to`. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** How long a trip is in days, counting both its first and last day. */
export function tripLengthDays(startDate: string, endDate: string): number {
  return daysBetween(startDate, endDate) + 1;
}

/** Days from today until the trip starts; negative once it has started. */
export function daysUntilStart(startDate: string): number {
  return daysBetween(today(), startDate);
}
