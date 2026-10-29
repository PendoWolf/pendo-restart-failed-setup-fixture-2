/** The Pendo agent id of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "nnbsahW0K8O2dvrrRJGJJT9hZZY";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of a Pendo trackAgent() event, without the agent id, which is always the Tripwise Assistant's. */
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

/**
 * Records a Tripwise Assistant event with pendo.trackAgent(), when a Pendo agent is loaded. Tracking never
 * breaks the chat: without a Pendo agent it does nothing, and a failing call is only logged.
 */
export function trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata): void {
  if (typeof pendo === "undefined" || typeof pendo.trackAgent !== "function") {
    return;
  }
  try {
    pendo.trackAgent(eventType, { agentId: TRIPWISE_ASSISTANT_AGENT_ID, ...metadata });
  } catch (error) {
    console.error("pendo.trackAgent failed", error);
  }
}
