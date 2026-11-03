import type { Request } from "express";
import type { Account, User } from "../types.js";

/** The Tripwise Assistant's agent id in Pendo Agent Analytics. */
export const TRIPWISE_ASSISTANT_AGENT_ID = "IE5eH1knn1SXVlpxv2avYRTBSyk";

export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** An agent event's metadata, with the same fields as Pendo's trackAgent(eventType, metadata). */
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

/** Who the event is about, and the request it came from. */
export interface AgentEventContext {
  req: Request;
  user: User;
  account: Account;
}

/**
 * Sends an agent event to Pendo as a server-side track event (the API runs on Node, where the browser's
 * window.pendo.trackAgent isn't available). Does nothing unless PENDO_TRACK_EVENT_SECRET is set, and never
 * throws or waits: a failed send is logged and the chat carries on.
 */
export function trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata, context: AgentEventContext): void {
  const secret = process.env.PENDO_TRACK_EVENT_SECRET;
  if (!secret) {
    return;
  }
  const { req, user, account } = context;
  const payload = {
    type: "track",
    event: eventType,
    visitorId: user.id,
    accountId: account.id,
    timestamp: Date.now(),
    properties: metadata,
    context: {
      ip: req.ip ?? "",
      userAgent: req.header("user-agent") ?? "",
      url: req.header("referer") ?? `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      title: "Tripwise Assistant",
    },
  };
  const trackUrl = process.env.PENDO_TRACK_URL ?? "https://app.pendo.io/data/track";
  fetch(trackUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pendo-integration-key": secret },
    body: JSON.stringify(payload),
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`Pendo ${eventType} event was rejected with status ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error(`Pendo ${eventType} event could not be sent`, error);
    });
}
