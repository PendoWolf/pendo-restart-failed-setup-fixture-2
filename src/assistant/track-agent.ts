/** The Pendo agent id of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "IePL9tEVv1MxjL3iBLOuNJpUwT0";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata Pendo's trackAgent() takes with every event. */
export interface AgentEventMetadata {
  agentId: string;
  conversationId: string;
  messageId: string;
  /** The message text, or the reaction type for user_reaction events. */
  content: string;
  modelUsed?: string;
  suggestedPrompt?: boolean;
  toolsUsed?: string[];
  fileUploaded?: boolean;
}

declare global {
  // Pendo's agent tracker, when one is installed on the global object.
  var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;
}

/**
 * Sends a Tripwise Assistant event to Pendo's trackAgent(). Does nothing when no Pendo tracker is installed,
 * and never lets a tracking failure break the chat.
 */
export function trackAgent(eventType: AgentEventType, metadata: Omit<AgentEventMetadata, "agentId">): void {
  try {
    globalThis.pendo?.trackAgent(eventType, { agentId: TRIPWISE_ASSISTANT_AGENT_ID, ...metadata });
  } catch (error) {
    console.error("Pendo trackAgent failed", error);
  }
}
