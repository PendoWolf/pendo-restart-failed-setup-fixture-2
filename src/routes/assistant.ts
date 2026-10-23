import { randomUUID } from "node:crypto";
import { Router } from "express";
import { trackEvent } from "../analytics/pendo.js";
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
  const conversationId = body.conversationId;
  const startedAt = Date.now();
  try {
    const upcomingTrips = tripStore.upcoming();
    const { content, stopReason } = await writeAssistantReply(messages, { user, account, upcomingTrips });
    const reply: ChatReply = {
      conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    // Pendo: the model produced a reply. Never sends message content.
    trackEvent("assistant_reply_generated", {
      visitorId: user.id,
      accountId: account.id,
      properties: {
        conversationId: conversationId.slice(0, 100),
        messageCount: messages.length,
        userMessageCount: messages.filter((message) => message.role === "user").length,
        upcomingTripsCount: upcomingTrips.length,
        model: ASSISTANT_MODEL,
        stopReason: stopReason ?? "unknown",
        refused: stopReason === "refusal",
        replyLength: content.length,
        latencyMs: Date.now() - startedAt,
        plan: account.plan,
      },
    });
    res.json(reply);
  } catch (error) {
    // Pendo: the call to the model failed; next(error) turns it into a 500.
    trackEvent("assistant_reply_failed", {
      visitorId: user.id,
      accountId: account.id,
      properties: {
        conversationId: conversationId.slice(0, 100),
        messageCount: messages.length,
        model: ASSISTANT_MODEL,
        errorType: error instanceof Error ? error.constructor.name : "UnknownError",
        latencyMs: Date.now() - startedAt,
      },
    });
    next(error);
  }
});
