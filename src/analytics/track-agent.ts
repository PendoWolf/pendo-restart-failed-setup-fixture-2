import type { Account, User } from "../types.js";

/** The Pendo agent id of the Tripwise Assistant. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "FF66VGYihthDRZqfM6RnrewMPVA";

/** The kinds of event Pendo's trackAgent records. */
export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata of a Pendo trackAgent event. */
export interface AgentEventMetadata {
  agentId: string;
  conversationId: string;
  messageId: string;
  /** The message text, or for a user_reaction the reaction: positive, negative, mixed, undo or retry. */
  content: string;
  modelUsed?: string;
  suggestedPrompt?: boolean;
  toolsUsed?: string[];
  fileUploaded?: boolean;
}

/**
 * Records a Pendo trackAgent event for the signed-in user. This is the API, so there's no browser `pendo` agent:
 * the event goes to Pendo's server-side Track Events API, with the trackAgent metadata as its properties.
 * Does nothing when PENDO_INTEGRATION_KEY isn't set, and never throws or waits: tracking mustn't slow down or
 * break the chat.
 */
export function trackAgent(
  eventType: AgentEventType,
  metadata: AgentEventMetadata,
  visitor: { user: User; account: Account },
): void {
  const integrationKey = process.env.PENDO_INTEGRATION_KEY;
  if (!integrationKey) {
    return;
  }
  const dataHost = process.env.PENDO_DATA_HOST || "https://app.pendo.io";
  fetch(`${dataHost}/data/track`, {
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
        console.error(`Pendo trackAgent "${eventType}" failed with status ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo trackAgent "${eventType}" failed`, error);
    });
}
