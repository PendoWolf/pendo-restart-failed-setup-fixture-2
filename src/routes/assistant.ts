import { randomUUID } from "node:crypto";
import { Router } from "express";
import { clip, PENDO_EVENTS, trackPendoEvent } from "../analytics/pendo.js";
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
  const ids = { visitorId: user.id, accountId: account.id };
  try {
    const upcomingTrips = tripStore.upcoming();
    const { content, refused } = await writeAssistantReply(messages, { user, account, upcomingTrips });
    // The model's reply came back (or it refused): an outcome the frontend's Send click can't show.
    trackPendoEvent(PENDO_EVENTS.assistantReplyGenerated, ids, {
      conversationId: clip(body.conversationId),
      messageCount: messages.length,
      userMessageCount: messages.filter((message) => message.role === "user").length,
      upcomingTripsCount: upcomingTrips.length,
      replyLength: content.length,
      refused,
      model: ASSISTANT_MODEL,
      accountPlan: account.plan,
      userRole: user.role,
    });
    const reply: ChatReply = {
      conversationId: body.conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    res.json(reply);
  } catch (error) {
    // The Anthropic call failed, so the request ends in the 500 error handler.
    trackPendoEvent(PENDO_EVENTS.assistantReplyFailed, ids, {
      conversationId: clip(body.conversationId),
      messageCount: messages.length,
      model: ASSISTANT_MODEL,
      errorType: clip(error instanceof Error ? error.name : typeof error, 64),
      userRole: user.role,
    });
    next(error);
  }
});
