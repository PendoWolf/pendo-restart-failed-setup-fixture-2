/** The Tripwise Assistant's agent id in Pendo. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "CLbgtqWt9LI9rM4QcR36lyOPTgs";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of a Pendo trackAgent event. */
export interface AgentEventMetadata {
  agentId: string;
  conversationId: string;
  messageId: string;
  /** The message text, or the reaction type for a user_reaction. */
  content: string;
  modelUsed?: string;
  suggestedPrompt?: boolean;
  toolsUsed?: string[];
  fileUploaded?: boolean;
}

/** Who the event is about: the signed-in user and their account. */
export interface AgentEventVisitor {
  visitorId: string;
  accountId: string;
}

// The API runs in Node, where there's no browser `window.pendo`, so agent events go to Pendo's server-side
// Track Events endpoint. Tracking is off unless PENDO_TRACK_EVENT_SECRET is set.
const PENDO_DATA_HOST = process.env.PENDO_DATA_HOST ?? "https://app.pendo.io";

/**
 * Pendo agent analytics for the API, with the same trackAgent(eventType, metadata) shape as the browser agent.
 * It never throws and never holds up the request: a failed send is only logged.
 */
export const pendo = {
  trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata, visitor: AgentEventVisitor): void {
    const integrationKey = process.env.PENDO_TRACK_EVENT_SECRET;
    if (!integrationKey) {
      return;
    }
    void fetch(`${PENDO_DATA_HOST}/data/track`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-pendo-integration-key": integrationKey },
      body: JSON.stringify({
        type: "track",
        event: eventType,
        visitorId: visitor.visitorId,
        accountId: visitor.accountId,
        timestamp: Date.now(),
        properties: metadata,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Pendo trackAgent ${eventType} failed with status ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        console.error(`Pendo trackAgent ${eventType} failed`, error);
      });
  },
};
