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
  const identity = { visitorId: user.id, accountId: account.id };
  const userTurnCount = messages.filter((message) => message.role === "user").length;
  const startedAt = Date.now();
  try {
    const upcomingTrips = tripStore.upcoming();
    const { content, wasRefusal } = await writeAssistantReply(messages, { user, account, upcomingTrips });
    const reply: ChatReply = {
      conversationId: body.conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    // The model answered (or refused): only known once the LLM call has finished.
    trackEvent("assistant_reply_generated", identity, {
      conversationId: body.conversationId,
      message_count: messages.length,
      user_turn_count: userTurnCount,
      upcoming_trip_count: upcomingTrips.length,
      model: ASSISTANT_MODEL,
      was_refusal: wasRefusal,
      reply_length: content.length,
      latency_ms: Date.now() - startedAt,
    });
    res.json(reply);
  } catch (error) {
    // The reply couldn't be written, such as an Anthropic API error. Anthropic's error classes are told apart by
    // their class name (RateLimitError, APIConnectionError, ...).
    trackEvent("assistant_reply_failed", identity, {
      conversationId: body.conversationId,
      message_count: messages.length,
      model: ASSISTANT_MODEL,
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      latency_ms: Date.now() - startedAt,
    });
    next(error);
  }
});
