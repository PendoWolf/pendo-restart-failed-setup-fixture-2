/** The Pendo agentId of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "tTYYCA2gASaULAKFm1qt5C7WPE8";

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

declare global {
  // The Pendo agent, when one is loaded. This API is a Node service, so it is undefined unless the runtime
  // provides one.
  var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;
}

/**
 * Sends a Pendo trackAgent event, and does nothing when no Pendo agent is loaded. Analytics never breaks a
 * request: an error from Pendo is logged, not thrown.
 */
export function trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata): void {
  try {
    globalThis.pendo?.trackAgent(eventType, metadata);
  } catch (error) {
    console.error("pendo.trackAgent failed", error);
  }
}
