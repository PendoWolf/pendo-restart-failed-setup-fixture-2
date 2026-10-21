import { randomUUID } from "node:crypto";
import { Router } from "express";
import { pendoFor } from "../analytics/pendo.js";
import type { AuthLocals } from "../auth/require-auth.js";
import { ASSISTANT_MODEL, writeAssistantReply } from "../assistant/reply.js";
import { tripStore } from "../store/trips.js";
import type { ChatReply, ChatRequest } from "../types.js";

/** The Tripwise Assistant's agent id in Pendo, for its trackAgent events. */
const PENDO_AGENT_ID = "UDWuRFzsVXZTfq65TOHRDfL9qg4";

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
  // Pendo's trackAgent events, for the signed-in user (the Pendo visitor) and their account.
  const pendo = pendoFor({ visitorId: user.id, accountId: account.id });
  // The conversation ends with the user's new message, the prompt this request answers.
  const prompt = messages[messages.length - 1];
  if (prompt.role === "user") {
    pendo.trackAgent("prompt", {
      agentId: PENDO_AGENT_ID,
      conversationId: body.conversationId,
      messageId: randomUUID(),
      content: prompt.content,
      // Messages are text only: there's no way to attach a file.
      fileUploaded: false,
    });
  }
  try {
    const content = await writeAssistantReply(messages, {
      user,
      account,
      upcomingTrips: tripStore.upcoming(),
    });
    const reply: ChatReply = {
      conversationId: body.conversationId,
      message: { id: randomUUID(), role: "assistant", content },
    };
    pendo.trackAgent("agent_response", {
      agentId: PENDO_AGENT_ID,
      conversationId: reply.conversationId,
      messageId: reply.message.id,
      content: reply.message.content,
      modelUsed: ASSISTANT_MODEL,
    });
    res.json(reply);
  } catch (error) {
    next(error);
  }
});
