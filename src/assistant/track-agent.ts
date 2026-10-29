/** The Tripwise Assistant's agent id in Pendo Agent Analytics. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "cCjBH7f_NEP7k3kbZr3o_fAN9CA";

/** The kinds of agent event Pendo tracks, as pendo.trackAgent() takes them. */
export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** An agent event's metadata, the same fields pendo.trackAgent() takes. */
export interface AgentEventMetadata {
  agentId: string;
  conversationId: string;
  messageId: string;
  /** The message's text, or for a user_reaction: "positive", "negative", "mixed", "undo" or "retry". */
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

/**
 * Sends an agent event to Pendo, the server-side counterpart of pendo.trackAgent(eventType, metadata). It goes to
 * Pendo's Track Events endpoint with the key in PENDO_TRACK_EVENT_SECRET, and does nothing when that isn't set.
 * It never waits on Pendo or throws, so tracking can't slow down or break a chat reply.
 */
export function trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata, visitor: AgentEventVisitor): void {
  const key = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!key) {
    return;
  }
  const url = process.env.PENDO_TRACK_EVENT_URL || "https://app.pendo.io/data/track";
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pendo-integration-key": key },
    body: JSON.stringify({
      type: "track",
      event: eventType,
      visitorId: visitor.visitorId,
      accountId: visitor.accountId,
      timestamp: Date.now(),
      properties: metadata,
    }),
    signal: AbortSignal.timeout(5000),
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`Pendo trackAgent "${eventType}" failed with status ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo trackAgent "${eventType}" failed`, error);
    });
}
