import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { AuthLocals } from "../auth/require-auth.js";
import { trackAgent } from "../analytics/pendo.js";
import { ASSISTANT_MODEL, ASSISTANT_PENDO_AGENT_ID, writeAssistantReply } from "../assistant/reply.js";
import { tripStore } from "../store/trips.js";
import type { ChatReply, ChatRequest } from "../types.js";

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
  const { conversationId } = body;
  // The message the user just sent is the last user message of the conversation.
  const prompt = messages.filter((message) => message.role === "user").at(-1);
  if (prompt) {
    trackAgent(
      "prompt",
      {
        agentId: ASSISTANT_PENDO_AGENT_ID,
        conversationId,
        messageId: randomUUID(),
        content: prompt.content,
        suggestedPrompt: false,
        fileUploaded: false,
      },
      { user, account },
    );
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
    trackAgent(
      "agent_response",
      {
        agentId: ASSISTANT_PENDO_AGENT_ID,
        conversationId,
        messageId: reply.message.id,
        content,
        modelUsed: ASSISTANT_MODEL,
        toolsUsed: [],
      },
      { user, account },
    );
    res.json(reply);
  } catch (error) {
    next(error);
  }
});
