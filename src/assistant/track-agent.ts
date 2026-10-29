/** The Pendo agent id of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "ZjFDuxSlTi2MZ-ediDUU8VdGG34";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of a Pendo trackAgent event. */
export interface AgentEventMetadata {
  agentId: string;
  conversationId: string;
  messageId: string;
  content: string;
  modelUsed?: string;
  suggestedPrompt?: boolean;
  toolsUsed?: string[];
  fileUploaded?: boolean;
}

// The Pendo agent is a global when it's loaded; it isn't typed by any package.
declare var pendo: { trackAgent: (eventType: string, metadata: object) => void };

/**
 * Sends a Tripwise Assistant event to Pendo with pendo.trackAgent(). Does nothing when no Pendo agent is loaded,
 * and never lets a tracking error fail the chat.
 */
export function trackAgent(eventType: AgentEventType, metadata: Omit<AgentEventMetadata, "agentId">): void {
  if (typeof pendo === "undefined" || typeof pendo.trackAgent !== "function") {
    return;
  }
  try {
    pendo.trackAgent(eventType, { agentId: TRIPWISE_ASSISTANT_AGENT_ID, ...metadata });
  } catch (error) {
    console.error("pendo.trackAgent failed", error);
  }
}
