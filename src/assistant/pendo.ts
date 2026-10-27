/** The Pendo agent id of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "imUyl5mFK2K6j6QTTXKf0tdIgw0";

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

declare global {
  // Pendo's trackAgent, when a Pendo agent is installed on the global object. Undefined otherwise.
  var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;
}

/**
 * Sends a Tripwise Assistant event to Pendo with pendo.trackAgent(). Does nothing when no Pendo agent is
 * installed, and never lets a tracking failure break the chat.
 */
export function trackAgent(eventType: AgentEventType, metadata: Omit<AgentEventMetadata, "agentId">): void {
  try {
    globalThis.pendo?.trackAgent(eventType, { agentId: TRIPWISE_ASSISTANT_AGENT_ID, ...metadata });
  } catch (error) {
    console.error("Pendo trackAgent failed", error);
  }
}
