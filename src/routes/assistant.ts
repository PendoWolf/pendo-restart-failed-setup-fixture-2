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
  const { conversationId } = body;
  const upcomingTrips = tripStore.upcoming();
  // Pendo: whether the model answered, refused or failed, with the conversation's size. Never the message content.
  const trackReply = (outcome: "answered" | "refused" | "failed", replyLength: number) => {
    trackPendoEvent(
      "assistant_reply_generated",
      { visitorId: user.id, accountId: account.id },
      {
        conversationId: conversationId.slice(0, 100),
        message_count: messages.length,
        upcoming_trip_count: upcomingTrips.length,
        model: ASSISTANT_MODEL,
        was_refusal: outcome === "refused",
        reply_length: replyLength,
        outcome,
        account_plan: account.plan,
        user_role: user.role,
      },
    );
  };
  try {
    const { content, refused } = await writeAssistantReply(messages, { user, account, upcomingTrips });
    trackReply(refused ? "refused" : "answered", content.length);
    const reply: ChatReply = {
      conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    res.json(reply);
  } catch (error) {
    trackReply("failed", 0);
    next(error);
  }
});
