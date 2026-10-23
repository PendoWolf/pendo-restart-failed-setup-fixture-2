/** The Pendo agent, where one is loaded. Its trackAgent API records the Tripwise Assistant's conversations. */
declare var pendo: { trackAgent: (eventType: string, metadata: object) => void };
