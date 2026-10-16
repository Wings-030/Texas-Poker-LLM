import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame, createHandRecord, performAction } from "../engine/gameFlow";
import { getLegalActions } from "../engine/betting";
import { defaultSaveData, loadSaveData, saveData } from "../storage/localStorage";

const legacyKey = "solo-texas-holdem-save";
let legacy: Map<string, string>;
beforeEach(() => {
  legacy = new Map();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("localStorage", { getItem: (key: string) => legacy.get(key) ?? null, removeItem: (key: string) => legacy.delete(key) });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("durable browser saves", () => {
  it("migrates the old save without touching unrelated visitor credentials", async () => {
    const saved = defaultSaveData();
    saved.statistics.hands = 123;
    saved.settings.language = "en";
    legacy.set(legacyKey, JSON.stringify(saved));
    legacy.set("visitor-token", "private");
    expect(await loadSaveData()).toEqual(saved);
    expect(legacy.has(legacyKey)).toBe(false);
    expect(legacy.get("visitor-token")).toBe("private");
    expect(await loadSaveData()).toEqual(saved);
  });

  it("retains 300 complete nine-player hands beyond localStorage's quota", async () => {
    let game = createGame({ mode: "quick", playerCount: 9, startingChips: 10000, smallBlind: 25, bigBlind: 50, aiDifficulty: "easy", speed: "instant", handsPerLevel: 5 }, () => 0.5);
    while (!game.result) {
      const id = game.players[game.currentPlayerIndex].id;
      game = performAction(game, id, getLegalActions(game, id).canCheck ? "check" : "call");
    }
    const saved = defaultSaveData();
    const record = createHandRecord(game);
    saved.history = Array.from({ length: 300 }, (_, index) => ({ ...structuredClone(record), id: `hand-${index}` }));
    saved.activeGame = game;
    expect(JSON.stringify(saved).length).toBeGreaterThan(5_000_000);
    await saveData(saved);
    const restored = await loadSaveData();
    expect(restored.history).toHaveLength(300);
    expect(restored.history[299].replay).toHaveLength(record.replay.length);
    expect(restored.activeGame!.players).toEqual(game.players);
  });

  it("reports migration failure and preserves the original for retry", async () => {
    const saved = defaultSaveData();
    legacy.set(legacyKey, JSON.stringify(saved));
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => { throw new DOMException("full", "QuotaExceededError"); });
    await expect(loadSaveData()).rejects.toThrow("full");
    expect(legacy.has(legacyKey)).toBe(true);
    put.mockRestore();
    expect(await loadSaveData()).toEqual(saved);
  });

  it("keeps the last committed save after a failed write and can retry", async () => {
    const saved = defaultSaveData();
    await saveData(saved);
    saved.statistics.hands = 42;
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => { throw new DOMException("full", "QuotaExceededError"); });
    await expect(saveData(saved)).rejects.toThrow("full");
    put.mockRestore();
    expect((await loadSaveData()).statistics.hands).toBe(0);
    await saveData(saved);
    expect((await loadSaveData()).statistics.hands).toBe(42);
  });

  it("serializes rapid saves and snapshots values when requested", async () => {
    const saved = defaultSaveData();
    const first = saveData(saved);
    saved.statistics.hands = 2;
    const last = saveData(saved);
    saved.statistics.hands = 99;
    await Promise.all([first, last]);
    expect((await loadSaveData()).statistics.hands).toBe(2);
  });

  it("reports unreadable saves instead of silently overwriting them with defaults", async () => {
    legacy.set(legacyKey, "broken JSON");
    await expect(loadSaveData()).rejects.toThrow();
    expect(legacy.get(legacyKey)).toBe("broken JSON");
  });
});
