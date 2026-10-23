/** The Pendo agent id of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "zrytAe5Ugi8YuO8v79sbDpFhm0c";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

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

/**
 * Sends a Tripwise Assistant event to Pendo with pendo.trackAgent(). Does nothing when no Pendo agent is
 * loaded, so a chat request never fails because of tracking.
 */
export function trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata): void {
  if (typeof pendo === "undefined" || typeof pendo.trackAgent !== "function") {
    return;
  }
  pendo.trackAgent(eventType, metadata);
}
