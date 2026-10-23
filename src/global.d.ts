/** The Pendo agent, when one is loaded. The API runs in Node, so check `typeof pendo` before calling it. */
declare var pendo: { trackAgent: (eventType: string, metadata: object) => void };
