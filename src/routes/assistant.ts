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
  const conversationId = body.conversationId;
  try {
    const { content, refused } = await writeAssistantReply(messages, { user, account, upcomingTrips });
    const reply: ChatReply = {
      conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    // Pendo: the model's reply came back and is about to be sent; only the server knows whether it refused.
    trackEvent(
      "assistant_reply_generated",
      { visitorId: user.id, accountId: account.id },
      {
        conversationId: truncate(conversationId),
        messageCount: messages.length,
        upcomingTripsCount: upcomingTrips.length,
        replyLength: content.length,
        refused,
        model: ASSISTANT_MODEL,
        accountPlan: account.plan,
        userRole: user.role,
      },
    );
    res.json(reply);
  } catch (error) {
    // Pendo: the reply couldn't be written (Anthropic API error, missing key, timeout), so the request ends in a 500.
    trackEvent(
      "assistant_reply_failed",
      { visitorId: user.id, accountId: account.id },
      {
        conversationId: truncate(conversationId),
        messageCount: messages.length,
        model: ASSISTANT_MODEL,
        errorType: truncate(error instanceof Error ? error.constructor.name : typeof error, 64),
        accountPlan: account.plan,
      },
    );
    next(error);
  }
});
