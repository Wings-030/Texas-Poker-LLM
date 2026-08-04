import characterProfiles from "../../shared/ai-characters.json";

export interface AIPlayerDefinition {
  id: string;
  name: string;
  code: string;
  personality: string;
  playingStyle: string;
}

export const AI_PLAYERS: AIPlayerDefinition[] = characterProfiles;

export function findAIPlayer(id: string): AIPlayerDefinition | undefined {
  return AI_PLAYERS.find((player) => player.id === id);
}
