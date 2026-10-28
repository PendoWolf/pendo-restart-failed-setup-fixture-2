/** The Pendo agent id of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "C4TqXzcLY4HN_3Dwfxrllp0UXv8";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of one pendo.trackAgent() event. */
export interface AgentEventMetadata {
  agentId: string;
  conversationId: string;
  messageId: string;
  /** The message text, or the reaction type for "user_reaction". */
  content: string;
  modelUsed?: string;
  suggestedPrompt?: boolean;
  toolsUsed?: string[];
  fileUploaded?: boolean;
}

/**
 * Sends an agent event to Pendo through pendo.trackAgent(). Does nothing when no Pendo agent is loaded, and
 * never lets a tracking failure break the request that triggered it.
 */
export function trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata): void {
  try {
    globalThis.pendo?.trackAgent(eventType, metadata);
  } catch (error) {
    console.error("pendo.trackAgent failed", error);
  }
}
