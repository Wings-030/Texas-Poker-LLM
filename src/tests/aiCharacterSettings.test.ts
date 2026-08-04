import { describe, expect, it } from "vitest";
import { getAICharacterSetting, setAICharacterSetting } from "../data/aiCharacterSettings";
import { defaultSettings } from "../storage/localStorage";

describe("AI character settings", () => {
  it("keeps the previous all-model behavior for saves without character settings", () => {
    const setting = getAICharacterSetting(defaultSettings, "ai-tomori");
    expect(setting.useModel).toBe(true);
    expect(setting.personality).toContain("Sincere");
    expect(setting.playingStyle).toContain("Tight-passive");
    expect(setting.prompt).toBe("");
  });

  it("stores a per-character model switch and prompt", () => {
    const current = getAICharacterSetting(defaultSettings, "ai-tomori");
    const updated = setAICharacterSetting(defaultSettings, "ai-tomori", { ...current, useModel: false, playingStyle: "Custom LAG", prompt: "Apply more pressure." });
    expect(getAICharacterSetting(updated, "ai-tomori")).toEqual({ ...current, useModel: false, playingStyle: "Custom LAG", prompt: "Apply more pressure." });
    expect(getAICharacterSetting(updated, "ai-sakiko").playingStyle).toContain("TAG");
  });
});
