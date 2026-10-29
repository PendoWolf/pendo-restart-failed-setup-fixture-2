/** The Pendo agent, when one is loaded. Its trackAgent() records Tripwise Assistant conversations. */
declare var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;
