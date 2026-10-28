// The Pendo agent, when one is loaded. Undefined otherwise, so callers must check for it.
declare var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;
