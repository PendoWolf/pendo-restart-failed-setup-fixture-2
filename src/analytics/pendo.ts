// Server-side Pendo Track Events, sent to Pendo's Track API (POST https://<data host>/data/track).
// The integration key is a secret, so it's read from PENDO_TRACK_EVENT_SECRET and never committed. Without it,
// events are skipped. Tracking is fire-and-forget: a failure is logged and never breaks the request.

const DEFAULT_DATA_HOST = "data.pendo-dev.pendo-dev.com";
const TIMEOUT_MS = 5000;

/** A Track Event property value, as Pendo accepts it. */
export type PendoPropertyValue = string | number | boolean | string[];

export interface PendoTrackEvent {
  /** The signed-in user's id, or "system" only when there is truly no user. */
  visitorId: string;
  /** The user's account id, or "system" only when there is truly no account. */
  accountId: string;
  properties?: Record<string, PendoPropertyValue>;
}

/** Cuts a free-text property value down so the event stays within Pendo's property size limit. */
export function truncateForPendo(value: string, maxLength = 100): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/** Sends a Track Event to Pendo in the background. Never throws and never delays the caller. */
export function trackPendoEvent(event: string, { visitorId, accountId, properties = {} }: PendoTrackEvent): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) return;
  const dataHost = process.env.PENDO_DATA_HOST || DEFAULT_DATA_HOST;
  try {
    fetch(`https://${dataHost}/data/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
      body: JSON.stringify({ type: "track", event, visitorId, accountId, timestamp: Date.now(), properties }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
      .then((response) => {
        if (!response.ok) console.error(`Pendo track event ${event} failed with status ${response.status}`);
      })
      .catch((error: unknown) => {
        console.error(`Pendo track event ${event} failed`, error);
      });
  } catch (error) {
    console.error(`Pendo track event ${event} failed`, error);
  }
}
