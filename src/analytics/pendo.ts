// Server-side Pendo Track Events, sent to Pendo's Track API (POST https://<data host>/data/track).
// The integration key is read from PENDO_TRACK_EVENT_SECRET and never committed. When it isn't set, events
// are skipped, so local development works without Pendo.

const DEFAULT_PENDO_DATA_HOST = "data.pendo-dev.pendo-dev.com";

/** A property value Pendo accepts on a Track Event. */
export type PendoPropertyValue = string | number | boolean | string[] | number[];

export interface PendoTrackEvent {
  /** The Track Event's name, exactly as it's registered in Pendo. */
  event: string;
  /** The signed-in user's id, or "system" when there's no user. */
  visitorId: string;
  /** The signed-in user's account id, or "system" when there's no account. */
  accountId: string;
  properties?: Record<string, PendoPropertyValue>;
}

/** Whole days from `from` to `to`, both ISO dates such as "2026-11-03". Negative when `to` comes first. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** Today's date in UTC, such as "2026-11-03". */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sends a Track Event to Pendo without waiting for it. Tracking never throws and never slows down or breaks
 * the request that triggered it: failures are only logged.
 */
export function trackPendoEvent({ event, visitorId, accountId, properties = {} }: PendoTrackEvent): void {
  const integrationKey = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!integrationKey) return;
  const dataHost = process.env.PENDO_DATA_HOST || DEFAULT_PENDO_DATA_HOST;
  try {
    fetch(`https://${dataHost}/data/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pendo-integration-key": integrationKey },
      body: JSON.stringify({ type: "track", event, visitorId, accountId, timestamp: Date.now(), properties }),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Pendo track event "${event}" was rejected with status ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        console.error(`Pendo track event "${event}" failed to send`, error);
      });
  } catch (error) {
    console.error(`Pendo track event "${event}" failed to send`, error);
  }
}
