import { randomUUID } from "node:crypto";
import { Router } from "express";
import { trackPendoEvent } from "../analytics/pendo.js";
import type { AuthLocals } from "../auth/require-auth.js";
import { ASSISTANT_MODEL, ASSISTANT_REFUSAL_REPLY, writeAssistantReply } from "../assistant/reply.js";
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
  try {
    const upcomingTrips = tripStore.upcoming();
    const content = await writeAssistantReply(messages, { user, account, upcomingTrips });
    const reply: ChatReply = {
      conversationId: body.conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    // The model produced a reply (or refused): only known once writeAssistantReply resolves.
    trackPendoEvent(
      "assistant_reply_generated",
      { visitorId: user.id, accountId: account.id },
      {
        conversationId: body.conversationId.slice(0, 100),
        messageCount: messages.length,
        userMessageCount: messages.filter((message) => message.role === "user").length,
        replyLength: content.length,
        refused: content === ASSISTANT_REFUSAL_REPLY,
        model: ASSISTANT_MODEL,
        upcomingTripCount: upcomingTrips.length,
        plan: account.plan,
      },
    );
    res.json(reply);
  } catch (error) {
    next(error);
  }
});
