/** The Pendo agent id of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "6bA_yDLZBrAdem5PTaSFhSJp8KA";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of a Pendo trackAgent() event, apart from the agent id. */
export interface AgentEventMetadata {
  conversationId: string;
  messageId: string;
  /** The message text, or the reaction type for a user_reaction. */
  content: string;
  modelUsed?: string;
  suggestedPrompt?: boolean;
  toolsUsed?: string[];
  fileUploaded?: boolean;
}

declare var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;

/**
 * Sends a Tripwise Assistant event to Pendo's trackAgent(). Does nothing when no Pendo agent is loaded, so
 * the assistant keeps answering either way.
 */
export function trackAssistantEvent(eventType: AgentEventType, metadata: AgentEventMetadata): void {
  if (typeof pendo === "undefined" || typeof pendo.trackAgent !== "function") {
    return;
  }
  try {
    pendo.trackAgent(eventType, { agentId: TRIPWISE_ASSISTANT_AGENT_ID, ...metadata });
  } catch (error) {
    console.error("Pendo trackAgent failed", error);
  }
}
