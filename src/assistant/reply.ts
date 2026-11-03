import Anthropic from "@anthropic-ai/sdk";
import type { Account, IncomingChatMessage, Trip, User } from "../types.js";

/** The model the Tripwise Assistant answers with. */
export const ASSISTANT_MODEL = "claude-opus-5-5";

// The SDK reads the key from the ANTHROPIC_API_KEY environment variable.
const anthropic = new Anthropic();

/** The assistant's instructions, with what it knows about the signed-in user and their upcoming trips. */
function systemPrompt(user: User, account: Account, upcomingTrips: Trip[]): string {
  const trips =
    upcomingTrips.length === 0
      ? "They have no upcoming trips yet."
      : `Their upcoming trips:\n${upcomingTrips
          .map((trip) => `- ${trip.destination}, ${trip.startDate} to ${trip.endDate}, ${trip.travelers} traveler(s)`)
          .join("\n")}`;
  return [
    "You are the Tripwise Assistant, a travel-planning agent inside the Tripwise web app.",
    "Help with itineraries, packing lists, budgets and cheaper alternatives. Keep answers short and practical.",
    `You're talking to ${user.name} from ${account.name}.`,
    trips,
  ].join("\n");
}

/** The assistant's reply, with how the model finished it. */
export interface AssistantReply {
  /** The reply's text, as the web app shows it. */
  content: string;
  /** The model that wrote the reply. */
  model: string;
  /** Why the model stopped, such as "end_turn" or "refusal". */
  stopReason: string;
  /** Whether the model refused, so the reply is the assistant's stock apology. */
  refused: boolean;
}

/**
 * Writes the Tripwise Assistant's reply to the conversation by sending it to a Claude model through the
 * Anthropic SDK, and returns the reply's text with how the model finished it.
 */
export async function writeAssistantReply(
  messages: IncomingChatMessage[],
  context: { user: User; account: Account; upcomingTrips: Trip[] },
): Promise<AssistantReply> {
  const response = await anthropic.messages.create({
    model: ASSISTANT_MODEL,
    max_tokens: 2000,
    system: systemPrompt(context.user, context.account, context.upcomingTrips),
    messages: messages.map(({ role, content }) => ({ role, content })),
  });
  const stopReason = response.stop_reason ?? "unknown";
  if (response.stop_reason === "refusal") {
    return {
      content: "Sorry, I can't help with that one. Ask me about another part of your trip.",
      model: response.model,
      stopReason,
      refused: true,
    };
  }
  const content = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n")
    .trim();
  return { content, model: response.model, stopReason, refused: false };
}
