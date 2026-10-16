import { describe, expect, it } from "vitest";
import { getLegalActions } from "../engine/betting";
import { createGame, createHandRecord, performAction, startNextHand } from "../engine/gameFlow";
import { eliminationPlace, nextTournamentState } from "../engine/tournament";
import { addHandToStatistics, emptyStatistics } from "../storage/localStorage";
import { cards, player } from "./testUtils";

function gameWithStacks(stacks: number[]) {
  const game = createGame({ mode: "quick", playerCount: stacks.length, startingChips: 2000, smallBlind: 50, bigBlind: 100, aiDifficulty: "easy", speed: "instant", handsPerLevel: 5 }, () => 0.5);
  game.players.forEach((p, i) => { p.chips = stacks[i]; });
  game.dealerIndex = stacks.length - 1;
  return startNextHand(game, () => 0.5);
}

describe("all-in and settlement regressions", () => {
  it("does not reopen a previous raiser or caller after a short all-in", () => {
    let game = gameWithStacks([2000, 2000, 350]);
    const ids = game.players.map((p) => p.id);
    game = performAction(game, ids[0], "raise", 300);
    game = performAction(game, ids[1], "call");
    game = performAction(game, ids[2], "all-in");
    expect(getLegalActions(game, ids[0])).toMatchObject({ toCall: 50, canCall: true, canRaise: false, canAllIn: false });
    expect(() => performAction(game, ids[0], "raise", 550)).toThrow();
    expect(() => performAction(game, ids[0], "all-in")).toThrow();
    game = performAction(game, ids[0], "call");
    expect(getLegalActions(game, ids[1]).canRaise).toBe(false);
    game = performAction(game, ids[1], "call");
    expect(game.phase).toBe("flop");
  });

  it("allows an unacted player to raise, and cumulative short raises reopen action", () => {
    let game = gameWithStacks([2000, 400, 500, 2000]);
    const ids = game.players.map((p) => p.id);
    game = performAction(game, ids[3], "raise", 300);
    game = performAction(game, ids[0], "call");
    game = performAction(game, ids[1], "all-in");
    expect(getLegalActions(game, ids[2]).canAllIn).toBe(true);
    game = performAction(game, ids[2], "all-in");
    expect(getLegalActions(game, ids[3])).toMatchObject({ canRaise: true, minRaiseTo: 700 });
    game = performAction(game, ids[3], "raise", 700);
    expect(getLegalActions(game, ids[0]).canRaise).toBe(true);
  });

  it("still permits an all-in call when raising is closed", () => {
    let game = gameWithStacks([340, 2000, 350]);
    const ids = game.players.map((p) => p.id);
    game = performAction(game, ids[0], "raise", 300);
    game = performAction(game, ids[1], "call");
    game = performAction(game, ids[2], "all-in");
    expect(getLegalActions(game, ids[0])).toMatchObject({ canAllIn: true, canRaise: false, canCall: false });
  });

  it("runs out a heads-up short big blind already covered by the small blind", () => {
    const game = gameWithStacks([1000, 40]);
    expect(game.phase).toBe("showdown");
    expect(game.actions).toHaveLength(0);
    expect(game.result!.awards.reduce((sum, award) => sum + award.amount, 0)).toBe(80);
    expect(Math.abs(game.result!.net.hero)).toBeLessThanOrEqual(40);
    expect(game.players.reduce((sum, p) => sum + p.chips, 0)).toBe(1040);
  });

  it("requires only the actual heads-up short blind but retains nominal blinds multiway", () => {
    const headsUp = gameWithStacks([1000, 75]);
    expect(getLegalActions(headsUp, "hero")).toMatchObject({ toCall: 25, canCall: true, canRaise: false, canAllIn: false });
    const multiway = gameWithStacks([1000, 1000, 40]);
    expect(multiway.currentBet).toBe(100);
    expect(getLegalActions(multiway, "hero").toCall).toBe(100);
  });

  it("refunds unmatched chips without counting a lost showdown as a win", () => {
    let game = gameWithStacks([1000, 200]);
    game.players[0].holeCards = cards("2c 3d");
    game.players[1].holeCards = cards("As Ad");
    game.deck = cards("4s 7h 9c Jd Ks");
    game.deckIndex = 0;
    game = performAction(game, "hero", "raise", 500);
    game = performAction(game, game.players[1].id, "all-in");
    expect(game.result!.winnerIds).toEqual([game.players[1].id]);
    expect(game.result!.awards.map((award) => award.amount)).toEqual([400]);
    expect(game.players.map((p) => p.chips)).toEqual([800, 400]);
    expect(game.result!.net.hero).toBe(-200);
    expect(addHandToStatistics(emptyStatistics, createHandRecord(game)).showdownWins).toBe(0);
  });

  it("refunds an uncalled raise when everyone folds", () => {
    let game = gameWithStacks([1000, 1000]);
    game = performAction(game, "hero", "raise", 500);
    game = performAction(game, game.players[1].id, "fold");
    expect(game.result!.awards[0].amount).toBe(200);
    expect(game.result!.net.hero).toBe(100);
    expect(game.players.map((p) => p.chips)).toEqual([1100, 900]);
  });

  it("counts all-in raises, but not all-in calls, toward PFR", () => {
    let call = gameWithStacks([100, 1000]);
    call = performAction(call, "hero", "all-in");
    const callStats = addHandToStatistics(emptyStatistics, createHandRecord(call));
    expect(callStats.vpipHands).toBe(1);
    expect(callStats.pfrHands).toBe(0);
    let raise = gameWithStacks([200, 1000]);
    raise = performAction(raise, "hero", "all-in");
    raise = performAction(raise, raise.players[1].id, "call");
    expect(addHandToStatistics(emptyStatistics, createHandRecord(raise)).pfrHands).toBe(1);
  });
});

describe("same-hand tournament elimination", () => {
  it.each([[1000, 200, 2, 3], [200, 1000, 3, 2], [200, 200, 2, 2]])("persists finish places for starting stacks %i and %i", (heroStack, otherStack, heroPlace, otherPlace) => {
    let game = gameWithStacks([heroStack, otherStack, 2000]);
    game.config.mode = "tournament";
    game.tournament = { blindLevel: 0, handsAtLevel: 0, handsUntilNextLevel: 5, eliminatedPlayerIds: [], finalStandings: [] };
    game.players[0].holeCards = cards("Qs Qd");
    game.players[1].holeCards = cards("Js Jd");
    game.players[2].holeCards = cards("As Ad");
    game.deck = cards("2s 4h 7c 9d Ks");
    game.deckIndex = 0;
    game = performAction(game, "hero", "all-in");
    game = performAction(game, game.players[1].id, "all-in");
    game = performAction(game, game.players[2].id, "call");
    expect(game.players.map((p) => p.finishPlace)).toEqual([heroPlace, otherPlace, 1]);
    expect(game.tournament!.championId).toBe(game.players[2].id);
  });

  it("orders simultaneous eliminations by starting stacks, regardless of seat", () => {
    const players = [player("p0", 0, 1000), player("p1", 0, 200), player("p2", 2000), player("p3", 500)];
    const tournament = { blindLevel: 0, handsAtLevel: 0, handsUntilNextLevel: 5, eliminatedPlayerIds: [], finalStandings: [] };
    expect(nextTournamentState(tournament, players, 5).finalStandings).toEqual(["p0", "p1"]);
    expect(eliminationPlace(players, "p0")).toBe(3);
    expect(eliminationPlace(players, "p1")).toBe(4);
    players[0].startingChips = 200;
    expect(eliminationPlace(players, "p0")).toBe(3);
    expect(eliminationPlace(players, "p1")).toBe(3);
  });
});
