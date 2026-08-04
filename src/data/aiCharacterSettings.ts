import type { AICharacterSetting, Settings } from "../types/poker";
import { findAIPlayer } from "./aiPlayers";

export function getAICharacterSetting(settings: Settings, characterId: string): AICharacterSetting {
  const configured = settings.aiCharacters?.[characterId];
  const defaults = findAIPlayer(characterId);
  return {
    useModel: configured?.useModel !== false,
    personality: typeof configured?.personality === "string" ? configured.personality : defaults?.personality ?? "",
    playingStyle: typeof configured?.playingStyle === "string" ? configured.playingStyle : defaults?.playingStyle ?? "",
    prompt: typeof configured?.prompt === "string" ? configured.prompt : "",
  };
}

export function setAICharacterSetting(settings: Settings, characterId: string, value: AICharacterSetting): Settings {
  return { ...settings, aiCharacters: { ...settings.aiCharacters, [characterId]: value } };
}
