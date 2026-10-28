/**
 * The Pendo agent's tracking API. This service runs on Node, where there is no browser Pendo snippet, so the
 * global is only present when a Pendo-compatible tracker has been installed on it; read it through
 * `globalThis.pendo?.` so a missing tracker is a no-op.
 */
declare var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;
