import { describe, expect, it } from "vitest";
import { createGame } from "../engine/gameFlow";
import type { GameConfig } from "../types/poker";

const config: GameConfig = {
  mode: "quick",
  playerCount: 3,
  aiPlayerIds: ["ai-tomori", "ai-rana"],
  startingChips: 1000,
  smallBlind: 25,
  bigBlind: 50,
  aiDifficulty: "normal",
  speed: "instant",
  handsPerLevel: 5,
};

describe("createGame computer player selection", () => {
  it("creates seats using the selected names and order", () => {
    const game = createGame(config, () => 0.5);

    expect(game.players.map(({ id, name, seat }) => ({ id, name, seat }))).toEqual([
      { id: "hero", name: "USER", seat: 0 },
      { id: "ai-tomori", name: "钥匙", seat: 1 },
      { id: "ai-rana", name: "闹钟", seat: 2 },
    ]);
    expect(game.config.playerCount).toBe(3);
  });

  it("rejects duplicate computer player selections", () => {
    expect(() => createGame({ ...config, aiPlayerIds: ["ai-tomori", "ai-tomori"] })).toThrow("电脑玩家选择无效");
  });
});
