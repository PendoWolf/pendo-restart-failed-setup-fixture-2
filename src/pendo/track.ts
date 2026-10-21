/** A track event property's value. Undefined values are left out of the event. */
export type TrackPropertyValue = string | number | boolean | string[] | undefined;

/** A Pendo track event: what happened, who did it, and details to segment it by. */
export interface TrackEvent {
  /** The event's name, exactly as its track type is registered in Pendo. */
  event: string;
  /** The signed-in user's id. */
  visitorId: string;
  /** The id of the signed-in user's account. */
  accountId: string;
  /** Details to segment the event by. Never an email, a name, a password or message content. */
  properties: Record<string, TrackPropertyValue>;
}

// Server-side track events go to Pendo's Track API. Its integration key is a secret, so it only ever comes from the
// environment: without PENDO_TRACK_EVENT_SECRET, no events are sent.
const dataHost = process.env.PENDO_DATA_HOST || "data.pendo-dev.pendo-dev.com";
const trackEventSecret = process.env.PENDO_TRACK_EVENT_SECRET;

/** How long to wait for Pendo before giving up on an event. */
const TIMEOUT_MS = 5000;

let warnedNoSecret = false;

/**
 * Sends a track event to Pendo in the background. It never throws and nothing waits for it, so tracking can't slow
 * down or break the request that triggered it.
 */
export function trackEvent(payload: TrackEvent): void {
  if (!trackEventSecret) {
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo track events aren't sent");
    }
    return;
  }
  send(payload, trackEventSecret).catch((error: unknown) => {
    console.error(`Pendo track event ${payload.event} wasn't sent:`, error);
  });
}

async function send({ event, visitorId, accountId, properties }: TrackEvent, secret: string): Promise<void> {
  const response = await fetch(`https://${dataHost}/data/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
    body: JSON.stringify(
      { type: "track", event, visitorId, accountId, timestamp: Date.now(), properties },
      // JSON would send NaN (say, from a date that doesn't exist) as null, so leave it out instead.
      (_key, value: unknown) => (typeof value === "number" && !Number.isFinite(value) ? undefined : value),
    ),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // Read the body either way, so the connection can be reused.
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Pendo answered ${response.status}: ${text.slice(0, 200)}`);
  }
}
