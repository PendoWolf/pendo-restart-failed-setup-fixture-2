/** The events Pendo's trackAgent API records about a conversation with an AI agent. */
export type AgentEventType = "prompt" | "agent_response" | "user_reaction";

/** What Pendo's trackAgent API takes with each event. */
export interface AgentEventMetadata {
  /** The agent's id in Pendo. */
  agentId: string;
  conversationId: string;
  messageId: string;
  /** The message's text, or for a "user_reaction" one of "positive", "negative", "mixed", "undo" or "retry". */
  content: string;
  /** The language model that wrote the agent's response. */
  modelUsed?: string;
  /** Whether the user sent a suggested prompt rather than one they wrote. */
  suggestedPrompt?: boolean;
  /** The tools the agent called for its response. */
  toolsUsed?: string[];
  /** Whether a file was attached to the message. */
  fileUploaded?: boolean;
}

/** Who an event is about: the Pendo visitor (the signed-in user) and their Pendo account. */
export interface PendoVisitor {
  visitorId: string;
  accountId: string;
}

/** An event, as Pendo's Track Events API takes it. */
interface TrackEvent {
  type: "track";
  event: AgentEventType;
  visitorId: string;
  accountId: string;
  /** When it happened, in milliseconds since the epoch. */
  timestamp: number;
  properties: AgentEventMetadata;
}

// The Track Event Shared Secret from the app's settings in Pendo. Without it, no events are sent.
const trackEventSecret = process.env.PENDO_TRACK_EVENT_SECRET;
// Pendo's Track Events endpoint, which depends on the subscription's region (https://app.eu.pendo.io/data/track in
// the EU).
const trackUrl = process.env.PENDO_TRACK_URL || "https://app.pendo.io/data/track";

/** Sends the event to Pendo's Track Events API, and throws when Pendo doesn't take it. */
async function sendTrackEvent(secret: string, event: TrackEvent): Promise<void> {
  const response = await fetch(trackUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pendo-integration-key": secret },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(5000),
  });
  // Read the body, though nothing needs it, so the connection can be reused.
  await response.text();
  if (!response.ok) {
    throw new Error(`Pendo's Track Events API answered ${response.status}`);
  }
}

/**
 * Pendo's trackAgent API, for the server. `pendo.trackAgent()` is part of Pendo's web SDK, which a server doesn't
 * have, so this sends each event to Pendo's Track Events API instead, for the given visitor. trackAgent never throws
 * or holds up the caller: a failed send is only logged.
 */
export function pendoFor({ visitorId, accountId }: PendoVisitor) {
  return {
    trackAgent(eventType: AgentEventType, metadata: AgentEventMetadata): void {
      if (!trackEventSecret) return;
      const event: TrackEvent = {
        type: "track",
        event: eventType,
        visitorId,
        accountId,
        timestamp: Date.now(),
        properties: metadata,
      };
      sendTrackEvent(trackEventSecret, event).catch((error: unknown) => {
        console.error(`Couldn't send a trackAgent "${eventType}" event to Pendo`, error);
      });
    },
  };
}
