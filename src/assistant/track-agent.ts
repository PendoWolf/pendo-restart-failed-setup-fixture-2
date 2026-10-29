/** The Pendo agent id of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "p9WzH45L2qVFobgWDLybUJVrWh4";

/** The kinds of agent event Pendo's trackAgent API takes. */
export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of an agent event, as Pendo's trackAgent API takes it. */
export interface AgentEventMetadata {
  agentId: string;
  conversationId: string;
  messageId: string;
  /** The message's text, or the reaction ("positive", "negative", "mixed", "undo" or "retry"). */
  content: string;
  modelUsed?: string;
  suggestedPrompt?: boolean;
  toolsUsed?: string[];
  fileUploaded?: boolean;
}

/** Who the event belongs to in Pendo: the signed-in user and their account. */
export interface AgentEventVisitor {
  visitorId: string;
  accountId: string;
}

const DEFAULT_TRACK_URL = "https://app.pendo.io/data/track";

/**
 * Sends an agent event to Pendo, the server-side counterpart of the browser's `pendo.trackAgent(eventType,
 * metadata)`, through Pendo's Track Events API. It does nothing unless PENDO_TRACK_EVENT_SECRET is set, and never
 * throws or delays the caller: a failed send is only logged.
 */
export function trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata, visitor: AgentEventVisitor): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    return;
  }
  const url = process.env.PENDO_TRACK_EVENT_URL || DEFAULT_TRACK_URL;
  fetch(url, {
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
        console.error(`Pendo trackAgent("${eventType}") failed with status ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo trackAgent("${eventType}") failed`, error);
    });
}
