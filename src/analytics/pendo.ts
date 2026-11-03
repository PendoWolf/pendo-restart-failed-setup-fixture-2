import type { Account, User } from "../types.js";

/** The Tripwise Assistant's agent id in Pendo. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "JnxwyHHhUzV_-3HSgEG0A4ZQDNE";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of a Pendo agent event, as Pendo's trackAgent() API defines it. */
export interface AgentEventMetadata {
  agentId: string;
  conversationId: string;
  messageId: string;
  /** The message text, or the reaction type ("positive", "negative", "mixed", "undo" or "retry") for "user_reaction". */
  content: string;
  modelUsed?: string;
  suggestedPrompt?: boolean;
  toolsUsed?: string[];
  fileUploaded?: boolean;
}

export interface PendoAgentTracker {
  trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata): void;
}

const DEFAULT_TRACK_URL = "https://app.pendo.io/data/track";

/**
 * Pendo's trackAgent() for one signed-in user. The API runs in Node, with no browser `window.pendo`, so each event
 * goes to Pendo's Track Events API with the user as the visitor and their company as the account. The integration
 * key comes from PENDO_TRACK_EVENT_SECRET; without it tracking is off. Sending never blocks the request, and a
 * failed send is only logged.
 */
export function pendoFor(user: User, account: Account): PendoAgentTracker {
  return {
    trackAgent(eventType, metadata) {
      const secret = process.env.PENDO_TRACK_EVENT_SECRET;
      if (!secret) {
        return;
      }
      fetch(process.env.PENDO_TRACK_URL || DEFAULT_TRACK_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-pendo-integration-key": secret },
        body: JSON.stringify({
          type: "track",
          event: eventType,
          visitorId: user.id,
          accountId: account.id,
          timestamp: Date.now(),
          properties: metadata,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            console.error(`Pendo ${eventType} event failed with status ${response.status}`);
          }
        })
        .catch((error: unknown) => {
          console.error(`Pendo ${eventType} event failed`, error);
        });
    },
  };
}
