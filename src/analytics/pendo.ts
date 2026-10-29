/** The Tripwise Assistant's agent id in Pendo. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "daxcr3Cn_Cyw_kYIXB76U0nK2bo";

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

const PENDO_TRACK_URL = process.env.PENDO_TRACK_URL || "https://app.pendo.io/data/track";

/**
 * The API's server-side counterpart of the browser's pendo.trackAgent(eventType, metadata): sends the agent event
 * to Pendo's Track Events API for the signed-in visitor. It never throws and never holds up the request; without
 * PENDO_TRACK_EVENT_SECRET set it does nothing.
 */
export function trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata, visitor: AgentEventVisitor): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    return;
  }
  fetch(PENDO_TRACK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pendo-integration-key": secret },
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
}
