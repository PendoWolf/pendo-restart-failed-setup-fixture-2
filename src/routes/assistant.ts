import { randomUUID } from "node:crypto";
import { Router } from "express";
import { trackEvent, truncate } from "../analytics/pendo.js";
import type { AuthLocals } from "../auth/require-auth.js";
import { ASSISTANT_MODEL, writeAssistantReply } from "../assistant/reply.js";
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
  const upcomingTrips = tripStore.upcoming();
  // What the event sends about the conversation. Never the message text.
  const conversation = {
    conversationId: truncate(body.conversationId),
    messageCount: messages.length,
    model: ASSISTANT_MODEL,
    upcomingTripCount: upcomingTrips.length,
    userId: user.id,
    plan: account.plan,
  };
  const startedAt = Date.now();
  try {
    const { content, stopReason, refused } = await writeAssistantReply(messages, { user, account, upcomingTrips });
    trackEvent(
      "assistant_reply_generated",
      { visitorId: user.id, accountId: account.id },
      {
        ...conversation,
        outcome: "replied",
        refused,
        stopReason: stopReason ?? undefined,
        replyLength: content.length,
        latencyMs: Date.now() - startedAt,
      },
    );
    const reply: ChatReply = {
      conversationId: body.conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    res.json(reply);
  } catch (error) {
    // No reply came back from the model.
    trackEvent(
      "assistant_reply_generated",
      { visitorId: user.id, accountId: account.id },
      { ...conversation, outcome: "failed", refused: false, latencyMs: Date.now() - startedAt },
    );
    next(error);
  }
});
