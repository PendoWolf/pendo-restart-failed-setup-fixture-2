/** The Pendo agent id of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "_2Csb4CZyiobX5W80BDQcX0ANBg";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata pendo.trackAgent() takes with each event. */
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
  // The Pendo agent, when one is installed in this process. It's undefined otherwise.
  var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;
}

/**
 * Sends an agent event to Pendo with pendo.trackAgent(). Does nothing when no Pendo agent is installed, and never
 * throws, so analytics can't fail a chat request.
 */
export function trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata): void {
  try {
    globalThis.pendo?.trackAgent(eventType, metadata);
  } catch (error) {
    console.error("pendo.trackAgent failed", error);
  }
}
