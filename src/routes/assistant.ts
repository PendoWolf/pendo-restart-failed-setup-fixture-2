import { randomUUID } from "node:crypto";
import { APIError } from "@anthropic-ai/sdk";
import { Router } from "express";
import type { AuthLocals } from "../auth/require-auth.js";
import { ASSISTANT_MODEL, writeAssistantReply } from "../assistant/reply.js";
import { trackEvent } from "../pendo/track.js";
import { tripStore } from "../store/trips.js";
import type { ChatReply, ChatRequest } from "../types.js";

/** The most of a conversation id a Pendo event carries, to keep within Pendo's size limit for event properties. */
const MAX_TRACKED_ID = 64;

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
  // What both of the assistant's Pendo events say about the conversation. Never any message content.
  const conversation = {
    conversationId: body.conversationId.slice(0, MAX_TRACKED_ID),
    turnCount: messages.filter((message) => message.role === "user").length,
    messageCount: messages.length,
    model: ASSISTANT_MODEL,
  };
  const upcomingTrips = tripStore.upcoming();
  const startedAt = performance.now();
  try {
    const { content, stopReason, usage } = await writeAssistantReply(messages, { user, account, upcomingTrips });
    const latencyMs = Math.round(performance.now() - startedAt);
    const reply: ChatReply = {
      conversationId: body.conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    // Pendo: the assistant replied, with how the model did: refused, cut off at max_tokens, slow, or fine.
    trackEvent({
      event: "assistant_reply_generated",
      visitorId: user.id,
      accountId: account.id,
      properties: {
        ...conversation,
        messageId: reply.message.id,
        stopReason: stopReason ?? "unknown",
        refused: stopReason === "refusal",
        latencyMs,
        replyLength: content.length,
        upcomingTripCount: upcomingTrips.length,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
      },
    });
    res.json(reply);
  } catch (error) {
    // Pendo: the assistant couldn't reply (a rate limit, a connection error, no API key...) and the user got a 500.
    trackEvent({
      event: "assistant_reply_failed",
      visitorId: user.id,
      accountId: account.id,
      properties: {
        ...conversation,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorStatus: error instanceof APIError ? error.status : undefined,
        latencyMs: Math.round(performance.now() - startedAt),
      },
    });
    next(error);
  }
});
