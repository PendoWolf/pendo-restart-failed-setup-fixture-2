/** Property values a Pendo Track Event accepts. Strings are cut to MAX_STRING_LENGTH. */
export type TrackProperties = Record<string, string | number | boolean>;

export interface TrackEvent {
  /** The Pendo track type's name, exactly as registered in Pendo. */
  event: string;
  /** The signed-in user's id. */
  visitorId: string;
  /** The signed-in user's account id. */
  accountId: string;
  properties?: TrackProperties;
}

const DEFAULT_DATA_HOST = "data.pendo-dev.pendo-dev.com";
// Pendo caps a Track Event's properties at 512 bytes, so long user-entered strings are cut short.
const MAX_STRING_LENGTH = 100;
const REQUEST_TIMEOUT_MS = 5000;

let warnedMissingKey = false;

function clampStrings(properties: TrackProperties): TrackProperties {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      typeof value === "string" ? value.slice(0, MAX_STRING_LENGTH) : value,
    ]),
  );
}

/**
 * Sends a server-side Pendo Track Event (POST https://<PENDO_DATA_HOST>/data/track). It never throws and never
 * delays the response: failures are only logged. Without PENDO_TRACK_EVENT_SECRET, events aren't sent.
 */
export function trackPendoEvent({ event, visitorId, accountId, properties = {} }: TrackEvent): void {
  try {
    // The Track Event shared secret is server-side only, so it comes from the environment, never from source.
    const integrationKey = process.env.PENDO_TRACK_EVENT_SECRET;
    if (!integrationKey) {
      if (!warnedMissingKey) {
        warnedMissingKey = true;
        console.warn("PENDO_TRACK_EVENT_SECRET isn't set, so Pendo Track Events aren't sent");
      }
      return;
    }
    const dataHost = process.env.PENDO_DATA_HOST || DEFAULT_DATA_HOST;
    fetch(`https://${dataHost}/data/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pendo-integration-key": integrationKey },
      body: JSON.stringify({
        type: "track",
        event,
        visitorId,
        accountId,
        timestamp: Date.now(),
        properties: clampStrings(properties),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Pendo Track Event "${event}" failed with status ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        console.error(`Pendo Track Event "${event}" failed`, error);
      });
  } catch (error) {
    console.error(`Pendo Track Event "${event}" failed`, error);
  }
}
