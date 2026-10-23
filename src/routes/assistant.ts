import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";
import { trackPendoEvent, trackString } from "../analytics/pendo.js";
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
    const { content, stopReason } = await writeAssistantReply(messages, { user, account, upcomingTrips });
    const reply: ChatReply = {
      conversationId: body.conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    // The model answered (or refused): only known once the LLM call has finished.
    trackPendoEvent("assistant_reply_generated", {
      visitorId: user.id,
      accountId: account.id,
      properties: {
        conversationId: trackString(body.conversationId),
        messageCount: messages.length,
        userMessageCount: messages.filter((message) => message.role === "user").length,
        replyLength: content.length,
        refused: stopReason === "refusal",
        stopReason: stopReason ?? "unknown",
        model: ASSISTANT_MODEL,
        upcomingTripCount: upcomingTrips.length,
        latencyMs: Date.now() - startedAt,
        accountPlan: account.plan,
        userRole: user.role,
      },
    });
    res.json(reply);
  } catch (error) {
    // The Anthropic call threw, so the request goes on to the 500 error handler.
    trackPendoEvent("assistant_reply_failed", {
      visitorId: user.id,
      accountId: account.id,
      properties: {
        conversationId: trackString(body.conversationId),
        messageCount: messages.length,
        errorType: error instanceof Error ? error.constructor.name : "unknown",
        ...(error instanceof Anthropic.APIError && error.status !== undefined && { statusCode: error.status }),
        model: ASSISTANT_MODEL,
        accountPlan: account.plan,
      },
    });
    next(error);
  }
});
