import type { Account, User } from "../types.js";

/** The kinds of event Pendo's trackAgent API records. */
export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** The metadata Pendo's trackAgent API takes with every event. */
export interface AgentEventMetadata {
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
 * Records an AI agent event in Pendo, the server-side counterpart of the browser's `pendo.trackAgent(eventType,
 * metadata)`. The API has no `window.pendo`, so the event goes to Pendo's Track Events API for the signed-in
 * visitor and account. Does nothing unless PENDO_TRACK_EVENT_SECRET is set, and never throws or holds up the
 * request: a failed send is only logged.
 */
export function trackAgent(
  eventType: AgentEventType,
  metadata: AgentEventMetadata,
  visitor: { user: User; account: Account },
): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    return;
  }
  const host = process.env.PENDO_DATA_HOST ?? "https://app.pendo.io";
  fetch(`${host}/data/track`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pendo-integration-key": secret },
    body: JSON.stringify({
      type: "track",
      event: eventType,
      visitorId: visitor.user.id,
      accountId: visitor.account.id,
      timestamp: Date.now(),
      properties: metadata,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`Pendo trackAgent("${eventType}") failed with status ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo trackAgent("${eventType}") failed`, error);
    });
}
