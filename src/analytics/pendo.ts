// Server-side Pendo Track Events, sent to Pendo's /data/track endpoint.
// The integration key comes from PENDO_TRACK_EVENT_SECRET; without it, events are skipped.
// The data host comes from PENDO_DATA_HOST.

const DEFAULT_DATA_HOST = "data.pendo-dev.pendo-dev.com";
const TRACK_TIMEOUT_MS = 5000;

/** Property values Pendo accepts on a Track Event. */
export type TrackPropertyValue = string | number | boolean | string[] | number[] | null | undefined;

export interface TrackEventInput {
  /** The id of the user the event belongs to. */
  visitorId: string;
  /** The id of the account (company) the user belongs to. */
  accountId: string;
  properties?: Record<string, TrackPropertyValue>;
}

let warnedMissingKey = false;

/** Shortens a free-text property value so the event stays inside Pendo's properties size limit. */
export function truncate(value: string, maxLength = 100): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * Sends a Track Event to Pendo. It never throws or rejects: a tracking failure is logged and
 * the request that triggered it carries on.
 */
export async function trackPendoEvent(event: string, { visitorId, accountId, properties }: TrackEventInput) {
  const integrationKey = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!integrationKey) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn("PENDO_TRACK_EVENT_SECRET is not set, so Pendo Track Events are not sent");
    }
    return;
  }
  const dataHost = process.env.PENDO_DATA_HOST || DEFAULT_DATA_HOST;
  // Leave out properties that have no value.
  const definedProperties = Object.fromEntries(
    Object.entries(properties ?? {}).filter(([, value]) => value !== undefined && value !== null),
  );
  try {
    const response = await fetch(`https://${dataHost}/data/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pendo-integration-key": integrationKey },
      body: JSON.stringify({
        type: "track",
        event,
        visitorId,
        accountId,
        timestamp: Date.now(),
        properties: definedProperties,
      }),
      signal: AbortSignal.timeout(TRACK_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`Pendo Track Event "${event}" was rejected with status ${response.status}`);
    }
  } catch (error) {
    console.error(`Pendo Track Event "${event}" could not be sent`, error);
  }
}
