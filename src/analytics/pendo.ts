import type { Request } from "express";

/** A Pendo Track Event property value. */
export type TrackPropertyValue = string | number | boolean | string[] | null;

export interface TrackEventInput {
  /** The Pendo visitor: the signed-in user's id, or "system" only when there's no user. */
  visitorId: string;
  /** The Pendo account: the user's account id, or "system" only when there's no account. */
  accountId: string;
  properties?: Record<string, TrackPropertyValue>;
  /** The request the event came from, for its user agent. */
  req?: Request;
}

// The data host isn't secret; the integration key is, so it only ever comes from the environment.
const dataHost = process.env.PENDO_DATA_HOST ?? "data.pendo-dev.pendo-dev.com";
const integrationKey = process.env.PENDO_TRACK_EVENT_SECRET;

let warnedMissingKey = false;

/**
 * Sends a server-side Track Event to Pendo (POST /data/track). It doesn't wait for Pendo and never throws,
 * so a tracking failure can't break the request that fired it. Does nothing when PENDO_TRACK_EVENT_SECRET
 * isn't set.
 */
export function trackEvent(event: string, { visitorId, accountId, properties = {}, req }: TrackEventInput): void {
  if (!integrationKey) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events are not sent");
    }
    return;
  }
  const userAgent = req?.header("user-agent");
  const body = {
    type: "track",
    event,
    visitorId,
    accountId,
    timestamp: Date.now(),
    properties,
    ...(userAgent && { context: { userAgent } }),
  };
  try {
    fetch(`https://${dataHost}/data/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pendo-integration-key": integrationKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Pendo Track Event "${event}" was rejected with status ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        console.error(`Pendo Track Event "${event}" failed to send`, error);
      });
  } catch (error) {
    console.error(`Pendo Track Event "${event}" failed to send`, error);
  }
}

/** Cuts a free-text value down so the event's properties stay well under Pendo's size limit. */
export function truncate(value: string, maxLength = 100): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
