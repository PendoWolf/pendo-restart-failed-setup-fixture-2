/** Pendo's agent-tracking API, present only where the Pendo agent has been installed. */
declare var pendo: { trackAgent: (eventType: string, metadata: object) => void };
