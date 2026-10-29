/** The Tripwise Assistant's agent id in Pendo. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "khFDNc7CjGWld2fxSjXBDM0qQek";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of one agent event, as Pendo's trackAgent() takes it. */
export interface AgentEventMetadata {
  agentId: string;
  conversationId: string;
  messageId: string;
  /** The message's text, or the reaction type for a "user_reaction". */
  content: string;
  modelUsed?: string;
  suggestedPrompt?: boolean;
  toolsUsed?: string[];
  fileUploaded?: boolean;
}

/** Who the event belongs to: the signed-in user and their account. */
export interface AgentEventVisitor {
  visitorId: string;
  accountId: string;
}

// Pendo's Track Events endpoint. Set PENDO_TRACK_URL for a Pendo region other than the default (US) one.
const trackUrl = process.env.PENDO_TRACK_URL ?? "https://app.pendo.io/data/track";

/**
 * The server-side counterpart of the browser's pendo.trackAgent(): sends one agent event to Pendo's Track Events
 * API. It does nothing when PENDO_TRACK_EVENT_SECRET isn't set, and never throws or holds up the caller: a failed
 * send is only logged.
 */
export function trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata, visitor: AgentEventVisitor): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    return;
  }
  fetch(trackUrl, {
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
    signal: AbortSignal.timeout(5000),
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
