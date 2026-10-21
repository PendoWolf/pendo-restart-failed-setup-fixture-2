import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AuthLocals } from "../auth/require-auth.js";
import { ASSISTANT_MODEL, writeAssistantReply } from "../assistant/reply.js";
import { tripStore } from "../store/trips.js";
import type { ChatReply, ChatRequest } from "../types.js";

declare global {
  /**
   * Pendo's agent, when one is loaded, whose trackAgent records conversations with AI agents. Read it as
   * globalThis.pendo: that's undefined without an agent, where a bare `pendo` would throw.
   */
  var pendo: { trackAgent: (eventType: string, metadata: object) => void } | undefined;
}

/** The Tripwise Assistant's agent id in Pendo, for its pendo.trackAgent events. */
const PENDO_AGENT_ID = "63hfOAR2eg53ebFmfWwQrUQdtmk";

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
  try {
    // The conversation's newest message is the prompt the user just sent.
    const prompt = messages[messages.length - 1];
    if (prompt.role === "user") {
      globalThis.pendo?.trackAgent("prompt", {
        agentId: PENDO_AGENT_ID,
        conversationId: body.conversationId,
        messageId: randomUUID(),
        content: prompt.content,
        // The chat takes text only, so a prompt never has a file attached.
        fileUploaded: false,
      });
    }
    const content = await writeAssistantReply(messages, {
      user,
      account,
      upcomingTrips: tripStore.upcoming(),
    });
    const reply: ChatReply = {
      conversationId: body.conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    // The web app gets this id back with the reply, so its reactions to the reply can share the messageId.
    globalThis.pendo?.trackAgent("agent_response", {
      agentId: PENDO_AGENT_ID,
      conversationId: reply.conversationId,
      messageId: reply.message.id,
      content: reply.message.content,
      modelUsed: ASSISTANT_MODEL,
    });
    res.json(reply);
  } catch (error) {
    next(error);
  }
});
