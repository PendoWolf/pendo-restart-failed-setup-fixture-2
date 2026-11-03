import { randomUUID } from "node:crypto";
import { Router } from "express";
import { pendoTrack, truncate } from "../analytics/pendo-track.js";
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
  // What the assistant_reply_generated Track Event reports on both success and failure.
  const conversationProperties = {
    conversationId: truncate(body.conversationId),
    messageCount: messages.length,
    userMessageCount: messages.filter((message) => message.role === "user").length,
    model: ASSISTANT_MODEL,
    upcomingTripCount: upcomingTrips.length,
    accountPlan: account.plan,
    userRole: user.role,
  };
  try {
    const content = await writeAssistantReply(messages, { user, account, upcomingTrips });
    const reply: ChatReply = {
      conversationId: body.conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    // The model answered (or refused): record how the assistant did on this conversation.
    pendoTrack({
      event: "assistant_reply_generated",
      visitorId: user.id,
      accountId: account.id,
      properties: {
        ...conversationProperties,
        replyLength: content.length,
        refused: content === REFUSAL_REPLY,
        outcome: "success",
      },
    });
    res.json(reply);
  } catch (error) {
    // The model call failed: record it so the assistant's failure rate can be measured.
    pendoTrack({
      event: "assistant_reply_generated",
      visitorId: user.id,
      accountId: account.id,
      properties: { ...conversationProperties, replyLength: 0, refused: false, outcome: "error" },
    });
    next(error);
  }
});
