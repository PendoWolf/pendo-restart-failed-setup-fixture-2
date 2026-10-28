import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AuthLocals } from "../auth/require-auth.js";
import { ASSISTANT_MODEL, writeAssistantReply } from "../assistant/reply.js";
import { tripStore } from "../store/trips.js";
import type { ChatReply, ChatRequest } from "../types.js";

export const assistantRouter = Router();

/** The Pendo agent id of the Tripwise Assistant. */
const PENDO_AGENT_ID = "q2fZWyAwV0-WwaUD2OjdvJ34PV0";

/**
 * Reports a Tripwise Assistant event to Pendo's trackAgent, when a Pendo tracker is installed. Tracking never
 * fails a chat request.
 */
function trackAgent(
  eventType: "prompt" | "agent_response",
  metadata: { conversationId: string; messageId: string; content: string; modelUsed?: string },
): void {
  try {
    globalThis.pendo?.trackAgent(eventType, { agentId: PENDO_AGENT_ID, ...metadata });
  } catch (error) {
    console.error("Pendo trackAgent failed", error);
  }
}

// The web app sends the whole conversation each time, so the API keeps no chat state of its own. The reply
// comes from a large language model (src/assistant/reply.ts).
assistantRouter.post("/chat", async (req, res, next) => {
  const body = req.body as Partial<ChatRequest> | undefined;
  if (!body || typeof body.conversationId !== "string" || !Array.isArray(body.messages)) {
    res.status(400).json({ error: "conversationId and messages are required" });
    return;
  }
  const messages = body.messages.filter(
    (message) =>
      (message?.role === "user" || message?.role === "assistant") && typeof message.content === "string",
  );
  if (messages.length === 0 || messages[0].role !== "user") {
    res.status(400).json({ error: "the conversation must start with a user message" });
    return;
  }
  const { user, account } = res.locals as AuthLocals;
  const latest = messages[messages.length - 1];
  if (latest.role === "user") {
    trackAgent("prompt", {
      conversationId: body.conversationId,
      messageId: randomUUID(),
      content: latest.content,
    });
  }
  try {
    const content = await writeAssistantReply(messages, {
      user,
      account,
      upcomingTrips: tripStore.upcoming(),
    });
    const reply: ChatReply = {
      conversationId: body.conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    trackAgent("agent_response", {
      conversationId: reply.conversationId,
      messageId: reply.message.id,
      content,
      modelUsed: ASSISTANT_MODEL,
    });
    res.json(reply);
  } catch (error) {
    next(error);
  }
});
