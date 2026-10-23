/** The Pendo agent id of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "HQdP1PHsx0h60aNk19_oLWETSe4";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata Pendo's trackAgent() takes with each event. */
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
  // Pendo's agent, when one is loaded into this process. Absent otherwise, so every call is guarded.
  var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;
}

/**
 * Sends an agent event to Pendo with trackAgent(). Does nothing when Pendo isn't loaded, and never throws, so
 * analytics can't break a chat request.
 */
export function trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata): void {
  try {
    globalThis.pendo?.trackAgent(eventType, metadata);
  } catch (error) {
    console.error("pendo.trackAgent failed", error);
  }
}
