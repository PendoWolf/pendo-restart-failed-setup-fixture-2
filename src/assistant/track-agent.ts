/** The Tripwise Assistant's agent id in Pendo. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "zDfQXMjAb6AQHp78BbSEAVR96u0";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** What pendo.trackAgent records with each event, minus the agent id, which is always the Tripwise Assistant's. */
export interface AgentEventMetadata {
  conversationId: string;
  messageId: string;
  /** The message's text, or the reaction ("positive", "negative", "mixed", "undo" or "retry"). */
  content: string;
  modelUsed?: string;
  suggestedPrompt?: boolean;
  toolsUsed?: string[];
  fileUploaded?: boolean;
}

/**
 * Records a Tripwise Assistant event with pendo.trackAgent. Does nothing when no Pendo agent is loaded (pendo is
 * a global the Pendo agent defines), and never lets analytics fail a chat request.
 */
export function trackAssistantEvent(eventType: AgentEventType, metadata: AgentEventMetadata): void {
  if (typeof pendo === "undefined" || typeof pendo.trackAgent !== "function") return;
  try {
    pendo.trackAgent(eventType, { agentId: TRIPWISE_ASSISTANT_AGENT_ID, ...metadata });
  } catch (error) {
    console.error("pendo.trackAgent failed", error);
  }
}
