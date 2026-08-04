import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHARACTERS = JSON.parse(readFileSync(path.join(ROOT, "shared", "ai-characters.json"), "utf8"));

export function getCharacter(characterId) {
  return CHARACTERS.find((character) => character.id === characterId) ?? null;
}

function json(value) { return JSON.stringify(value ?? null, null, 2); }

export function buildPokerMessages({ characterId, gameState, characterPrompt }) {
  const character = getCharacter(characterId);
  if (!character) throw new Error(`Unknown AI character: ${characterId}`);
  const personality = typeof characterPrompt?.personality === "string" ? characterPrompt.personality.trim().slice(0, 12000) : character.personality;
  const playingStyle = typeof characterPrompt?.playingStyle === "string" ? characterPrompt.playingStyle.trim().slice(0, 12000) : character.playingStyle;
  const additional = typeof characterPrompt?.additional === "string" ? characterPrompt.additional.trim().slice(0, 12000) : "";
  const systemPrompt = [
    "# Core System Prompt",
    "You are an AI poker player in a Texas Hold'em game.",
    "You must make decisions only from the information provided.",
    "Never invent cards, chip counts, actions, rules, or hidden information.",
    "Do not assume knowledge of other players' hole cards.",
    "Choose only from the legal actions provided by the game.",
    "Return the required structured output.",
    "Do not reveal hidden chain-of-thought or include a reasoning summary in the response.",
    "",
    "# Private Reasoning and Public Speech Boundary",
    "Use the AI Private Hand freely in private reasoning to choose an action, but treat table_talk as public speech visible to every player.",
    "Follow this internal workflow: analyze the hand, choose the action, discard all wording from the private analysis, then write table_talk using only public actions, table atmosphere, general pressure, and character emotion.",
    "Never copy, paraphrase, explain, or hint at the private reason for the chosen action in table_talk.",
    "Before returning JSON, silently check whether table_talk could help another player infer either hole card or the private hand evaluation. If it could, rewrite it generically.",
    "",
    "# Poker Rules",
    "This is no-limit Texas Hold'em. Respect the supplied call amount, minimum raise-to amount, maximum raise-to amount, player stacks, and legal actions.",
    "The amount field is the final total street bet for bet or raise. Use 0 for fold, check, call, or all-in.",
    "",
    "# Output Protocol",
    "Return exactly one JSON object and no Markdown:",
    '{"action":"fold|check|call|bet|raise|all_in","amount":0,"table_talk":""}',
    "table_talk must always be written in Simplified Chinese, regardless of the language used in the character profile, custom instructions, or Recent Conversation.",
    "table_talk must be 1 to 2 natural sentences in the character's voice, roughly 15 to 60 Chinese characters in total.",
    "Do not write English or Japanese sentences in table_talk. Use Chinese poker terms whenever possible.",
    "table_talk may bluff, react to visible actions, or apply general pressure, but it must not explain the decision.",
    "Do not mention any card rank or suit in table_talk, including A, K, Q, J, 10, ace, king, queen, jack, or Chinese equivalents.",
    "Do not mention or imply hole cards, high cards, kickers, pairs, hand categories, draws, outs, equity, whether the hand connected with the board, or whether the private hand is strong or weak.",
    "Forbidden examples include: \"我的K\", \"我有A\", \"K高\", \"没对子\", \"中了顶对\", \"在听花\", \"差一张顺子\", and \"这两张牌不太行\".",
    "",
    "# AI Character Personality",
    `Name: ${character.name}`,
    personality,
    "",
    "# AI Playing Style",
    playingStyle,
    ...(additional ? [
      "",
      "# Custom Character Prompt",
      "Apply the following user-authored character instructions when they do not conflict with the poker rules, legal actions, privacy requirements, or output protocol above.",
      additional,
    ] : []),
  ].join("\n");

  const userPrompt = [
    "# Current Table Information", json(gameState.table),
    "# Player Public Information", json(gameState.players),
    "# AI Private Hand", json(gameState.aiHoleCards),
    "# Community Cards", json(gameState.communityCards),
    "# Betting History", json(gameState.bettingHistory),
    "# Current Pot and Stack", json(gameState.chips),
    "# Legal Actions", json(gameState.legalActions),
    "# Recent Conversation", json(gameState.recentConversation),
    "# Final Decision Instruction",
    "Choose one legal action now. Return only the JSON object required by the system prompt.",
  ].join("\n\n");
  return { character, systemPrompt, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] };
}
