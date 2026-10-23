// Pendo's agent is not typed in this project, and it only exists where a Pendo agent has been loaded.
declare var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;

/** The Pendo agentId of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "Kw2fqjdTo0W8XQCv-VWlV1WiKcg";

export type TrackAgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of a Pendo trackAgent() event. */
export interface TrackAgentMetadata {
  agentId: string;
  conversationId: string;
  messageId: string;
  /** The message text, or the reaction ("positive", "negative", "mixed", "undo" or "retry"). */
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
