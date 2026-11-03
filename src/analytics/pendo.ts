/** The agentId Pendo knows the Tripwise Assistant by. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "fFSOjOaFRbW_RiS3PWVaezZeRwk";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of a pendo.trackAgent() event. */
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

declare global {
  var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;
}

/**
 * Sends an agent event to Pendo with pendo.trackAgent(), when a Pendo agent is loaded. Without one it does
 * nothing, and tracking never gets in the way of the chat.
 */
export function trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata): void {
  try {
    globalThis.pendo?.trackAgent(eventType, metadata);
  } catch (error) {
    console.error("pendo.trackAgent failed", error);
  }
}
