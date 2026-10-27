/** The Tripwise Assistant's agent id in Pendo. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "mja1kiMxBH1l3vBIkBRzAxbAJd0";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of a Pendo agent event, as pendo.trackAgent() takes it. */
export interface AgentEventMetadata {
  agentId: string;
  conversationId: string;
  messageId: string;
  /** The message's text, or for a user_reaction one of "positive", "negative", "mixed", "undo" or "retry". */
  content: string;
  modelUsed?: string;
  suggestedPrompt?: boolean;
  toolsUsed?: string[];
  fileUploaded?: boolean;
}

/** Who the agent event belongs to: the signed-in user and their account. */
export interface AgentEventVisitor {
  visitorId: string;
  accountId: string;
}

// Pendo's server-side Track Events endpoint. Its shared secret comes from PENDO_TRACK_EVENT_SECRET and is never
// committed; without it, agent events are skipped.
const PENDO_TRACK_URL = `${process.env.PENDO_DATA_HOST ?? "https://app.pendo.io"}/data/track`;

/**
 * The server-side counterpart of the browser's pendo.trackAgent(eventType, metadata): sends one Tripwise
 * Assistant event to Pendo for the given visitor. It never throws and never holds up the caller.
 */
export function trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata, visitor: AgentEventVisitor): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    return;
  }
  fetch(PENDO_TRACK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pendo-integration-key": secret },
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
        console.error(`Pendo trackAgent("${eventType}") failed with status ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo trackAgent("${eventType}") failed`, error);
    });
}
