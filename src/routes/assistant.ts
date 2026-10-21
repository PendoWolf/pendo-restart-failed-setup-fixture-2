import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
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
  const upcomingTrips = tripStore.upcoming();
  const startedAt = Date.now();
  try {
    const { content, stopReason, usage } = await writeAssistantReply(messages, { user, account, upcomingTrips });
    const reply: ChatReply = {
      conversationId: body.conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    // The model answered (possibly with a refusal or empty text). Never send the conversation's content to Pendo.
    trackEvent("assistant_reply_generated", { user, account }, {
      conversationId: body.conversationId,
      messageId: reply.message.id,
      messageCount: messages.length,
      userMessageCount: messages.filter((message) => message.role === "user").length,
      isNewConversation: messages.length === 1,
      model: ASSISTANT_MODEL,
      stopReason,
      refused: stopReason === "refusal",
      replyLength: content.length,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      latencyMs: Date.now() - startedAt,
      upcomingTripsCount: upcomingTrips.length,
    });
    res.json(reply);
  } catch (error) {
    // The model call failed (such as a missing or invalid key, a rate limit or a timeout), so the web app gets a 500.
    trackEvent("assistant_reply_failed", { user, account }, {
      conversationId: body.conversationId,
      messageCount: messages.length,
      isNewConversation: messages.length === 1,
      model: ASSISTANT_MODEL,
      // The SDK's errors are all named "Error", so their class tells them apart, such as RateLimitError.
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorStatus: error instanceof Anthropic.APIError ? error.status : undefined,
      latencyMs: Date.now() - startedAt,
    });
    next(error);
  }
});
