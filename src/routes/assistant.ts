import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AuthLocals } from "../auth/require-auth.js";
import { ASSISTANT_MODEL, writeAssistantReply } from "../assistant/reply.js";
import { tripStore } from "../store/trips.js";
import type { ChatReply, ChatRequest } from "../types.js";

// Pendo's agent analytics API. It only exists where the Pendo agent is loaded, so every call is guarded.
declare var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;

/** The Pendo agent id of the Tripwise Assistant. */
const PENDO_AGENT_ID = "BBzFOTsY_li1Fgl62y4t-lnHOYM";

/** Sends a Tripwise Assistant event to Pendo when the Pendo agent is available; otherwise does nothing. */
function trackAgent(eventType: "prompt" | "agent_response", metadata: object): void {
  if (typeof pendo !== "undefined" && typeof pendo.trackAgent === "function") {
    pendo.trackAgent(eventType, { agentId: PENDO_AGENT_ID, ...metadata });
  }
}

export const assistantRouter = Router();

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
  const conversationId = body.conversationId;
  // The newest message is the prompt the user just sent.
  const prompt = messages[messages.length - 1];
  if (prompt.role === "user") {
    trackAgent("prompt", {
      conversationId,
      messageId: randomUUID(),
      content: prompt.content,
      suggestedPrompt: false,
      fileUploaded: false,
    });
  }
  try {
    const content = await writeAssistantReply(messages, {
      user,
      account,
      upcomingTrips: tripStore.upcoming(),
    });
    const reply: ChatReply = {
      conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    trackAgent("agent_response", {
      conversationId,
      messageId: reply.message.id,
      content,
      modelUsed: ASSISTANT_MODEL,
      toolsUsed: [],
    });
    res.json(reply);
  } catch (error) {
    next(error);
  }
});
