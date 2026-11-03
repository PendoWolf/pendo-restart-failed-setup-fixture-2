import { randomUUID } from "node:crypto";
import { Router } from "express";
import { trackEvent } from "../analytics/pendo.js";
import type { AuthLocals } from "../auth/require-auth.js";
import { ASSISTANT_MODEL, REFUSAL_REPLY, writeAssistantReply } from "../assistant/reply.js";
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
  // What every assistant_reply_generated event carries, whether the model answered or failed.
  const replyContext = {
    conversationId: body.conversationId.slice(0, 100),
    messageCount: messages.length,
    model: ASSISTANT_MODEL,
    upcomingTripCount: upcomingTrips.length,
    accountPlan: account.plan,
    userRole: user.role,
  };
  try {
    const content = await writeAssistantReply(messages, {
      user,
      account,
      upcomingTrips,
    });
    const reply: ChatReply = {
      conversationId: body.conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    res.json(reply);
    // Pendo: the model's reply came back and went to the chat panel.
    const refused = content === REFUSAL_REPLY;
    trackEvent(
      "assistant_reply_generated",
      { visitorId: user.id, accountId: account.id },
      { ...replyContext, outcome: refused ? "refused" : "replied", refused, replyLength: content.length },
    );
  } catch (error) {
    // Pendo: the model call failed, so the chat panel gets an error instead of a reply.
    trackEvent(
      "assistant_reply_generated",
      { visitorId: user.id, accountId: account.id },
      { ...replyContext, outcome: "error", refused: false, replyLength: 0 },
    );
    next(error);
  }
});
