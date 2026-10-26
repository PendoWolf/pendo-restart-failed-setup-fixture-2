import type { Account, User } from "../types.js";

/** The Tripwise Assistant's id in Pendo Agent Analytics. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "Eruh-Ll3u522w362q4KXIGqgz9E";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of a Pendo trackAgent event. */
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

const DEFAULT_TRACK_URL = "https://app.pendo.io/data/track";

/**
 * The server-side counterpart of the Pendo agent's pendo.trackAgent(eventType, metadata), for the signed-in
 * user and their account. Each event goes to Pendo's Track Events API, keyed by the PENDO_TRACK_EVENT_SECRET
 * environment variable; without it nothing is sent. Tracking never holds up or fails the request.
 */
export function pendoFor(user: User, account: Account) {
  return {
    trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata): void {
      const secret = process.env.PENDO_TRACK_EVENT_SECRET;
      if (!secret) {
        return;
      }
      void fetch(process.env.PENDO_TRACK_URL ?? DEFAULT_TRACK_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-pendo-integration-key": secret },
        body: JSON.stringify({
          type: "track",
          event: eventType,
          visitorId: user.id,
          accountId: account.id,
          timestamp: Date.now(),
          properties: metadata,
          context: {},
        }),
      })
        .then((response) => {
          if (!response.ok) {
            console.error(`Pendo trackAgent "${eventType}" failed with status ${response.status}`);
          }
        })
        .catch((error: unknown) => {
          console.error(`Pendo trackAgent "${eventType}" failed`, error);
        });
    },
  };
}
