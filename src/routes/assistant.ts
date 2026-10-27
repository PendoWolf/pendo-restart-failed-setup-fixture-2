import { randomUUID } from "node:crypto";
import { Router } from "express";
import { trackPendoEvent } from "../analytics/pendo.js";
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
  // Pendo: the assistant's reply is ready, or the call to the model failed.
  const trackReply = (outcome: "answered" | "refused" | "failed", replyLength: number) => {
    trackPendoEvent("assistant_reply_generated", {
      visitorId: user.id,
      accountId: account.id,
      properties: {
        conversation_id: body.conversationId,
        message_count: messages.length,
        user_message_count: messages.filter((message) => message.role === "user").length,
        outcome,
        refused: outcome === "refused",
        reply_length: replyLength,
        upcoming_trip_count: upcomingTrips.length,
        model: ASSISTANT_MODEL,
        latency_ms: Date.now() - startedAt,
        account_id: account.id,
        account_plan: account.plan,
      },
    });
  };
  try {
    const { text: content, refused } = await writeAssistantReply(messages, { user, account, upcomingTrips });
    trackReply(refused ? "refused" : "answered", content.length);
    const reply: ChatReply = {
      conversationId: body.conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    res.json(reply);
  } catch (error) {
    trackReply("failed", 0);
    next(error);
  }
});
