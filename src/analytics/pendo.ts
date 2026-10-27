import type { Account, User } from "../types.js";

/** The Pendo agent id of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "K9WWmEBBx6CnHtM4oW7xxU1F5H8";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of an agent event, the same shape the browser agent's pendo.trackAgent() takes. */
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

// This is a server, so there's no window.pendo: agent events go to Pendo's Track Events API instead. Its key
// is server-side and secret, so it only ever comes from the environment; without it, tracking is off.
const trackUrl = process.env.PENDO_TRACK_URL ?? "https://app.pendo.io/data/track";

/**
 * Sends a Tripwise Assistant event to Pendo for the signed-in user and their account. It never throws and
 * never holds up the request: a failed send is only logged.
 */
export function trackAgent(
  eventType: AgentEventType,
  metadata: AgentEventMetadata,
  visitor: { user: User; account: Account },
): void {
  const integrationKey = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!integrationKey) {
    return;
  }
  fetch(trackUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pendo-integration-key": integrationKey },
    body: JSON.stringify({
      type: "track",
      event: eventType,
      visitorId: visitor.user.id,
      accountId: visitor.account.id,
      timestamp: Date.now(),
      properties: metadata,
    }),
    signal: AbortSignal.timeout(5000),
  })
    .then((response) => {
      if (!response.ok) {
        console.warn(`Pendo ${eventType} event was rejected with status ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.warn(`Pendo ${eventType} event could not be sent`, error);
    });
}
