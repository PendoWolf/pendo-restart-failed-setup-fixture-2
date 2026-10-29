import type { Request } from "express";

/** A Track Event property value Pendo accepts. */
export type PendoPropertyValue = string | number | boolean | null;

export interface PendoTrackEvent {
  /** The Track Event's name, exactly as it's registered in Pendo. */
  event: string;
  /** The id of the user who did it. */
  visitorId: string;
  /** The id of that user's account. */
  accountId: string;
  properties?: Record<string, PendoPropertyValue>;
  /** The request it came from, for the event's context (IP and user agent). */
  req?: Request;
}

// The integration key is a server-side secret: it's read from the environment and never committed.
const trackEventSecret = process.env.PENDO_TRACK_EVENT_SECRET;
const dataHost = process.env.PENDO_DATA_HOST ?? "data.pendo-dev.pendo-dev.com";

/**
 * Sends a Track Event to Pendo's server-side Track API (POST /data/track). It doesn't wait for Pendo and never
 * throws: a failed send is logged, and the request that caused the event carries on regardless. Without
 * PENDO_TRACK_EVENT_SECRET it does nothing.
 */
export function trackPendoEvent({ event, visitorId, accountId, properties = {}, req }: PendoTrackEvent): void {
  if (!trackEventSecret) return;
  try {
    const body = {
      type: "track",
      event,
      visitorId,
      accountId,
      timestamp: Date.now(),
      properties,
      ...(req && { context: { ip: req.ip, userAgent: req.get("user-agent") } }),
    };
    fetch(`https://${dataHost}/data/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pendo-integration-key": trackEventSecret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
      .then((response) => {
        if (!response.ok) console.error(`Pendo Track Event "${event}" was rejected with ${response.status}`);
      })
      .catch((error: unknown) => {
        console.error(`Pendo Track Event "${event}" couldn't be sent`, error);
      });
  } catch (error) {
    console.error(`Pendo Track Event "${event}" couldn't be sent`, error);
  }
}
