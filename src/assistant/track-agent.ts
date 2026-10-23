// Pendo's agent is not typed in this project; it is only present where a Pendo agent has been loaded.
declare var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;

/** The Pendo agentId of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "Tel-6xDyQoTfUF-3mFZOao9qc6s";

export type TrackAgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of a Pendo trackAgent() event. */
export interface TrackAgentMetadata {
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
 * Sends a Tripwise Assistant event to Pendo with pendo.trackAgent(). Does nothing when no Pendo agent is loaded,
 * and never lets a tracking failure break the chat.
 */
export function trackAgent(eventType: TrackAgentEventType, metadata: TrackAgentMetadata): void {
  if (typeof pendo === "undefined" || typeof pendo?.trackAgent !== "function") {
    return;
  }
  try {
    pendo.trackAgent(eventType, metadata);
  } catch (error) {
    console.error("pendo.trackAgent failed", error);
  }
}
