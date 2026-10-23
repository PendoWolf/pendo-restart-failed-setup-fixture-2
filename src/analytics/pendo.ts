import type { Account, User } from "../types.js";

/** The Tripwise Assistant's agent id in Pendo. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "Mv14nEOpfwhk9tN0DeanmGJPlto";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** What every Pendo agent event carries, as Pendo's trackAgent API defines it. */
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

export interface PendoAgentTracker {
  trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata): void;
}

const DEFAULT_TRACK_URL = "https://app.pendo.io/data/track";

/**
 * Pendo's agent tracking for one signed-in user. The API has no browser `window.pendo`, so the events go to
 * Pendo's Track Events API, keyed by the shared secret in PENDO_TRACK_EVENT_SECRET. Without that secret it does
 * nothing, and a failed send is only logged: tracking never breaks the request.
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
