import { describe, expect, it } from "vitest";
import { advanceGame, applyCommand, createInitialGame, createRematch } from "./game";
import { allianceRoll, areAllied, evaluateAlliance } from "./diplomacy";
import type { GameState } from "./types";
const advance = (state: GameState, ticks: number) => { for (let i = 0; i < ticks; i++) state = advanceGame(state); return state; };
const proposal = { type: "ally" as const, player: "human" as const, with: "bot" as const };
const forceRoll = (state: GameState, roll: number): GameState => ({ ...state, pendingAlliances: state.pendingAlliances!.map(p => ({ ...p, roll })) });

describe("bot alliance proposals", () => {
  it("waits five ticks, blocks duplicates and trade, then accepts when the decision succeeds", () => {
    const game = createInitialGame();
    const from = game.map.territories.find(t => t.capitalFor === "human")!.id;
    const to = game.map.territories.find(t => t.capitalFor === "bot")!.id;
    const request = applyCommand(game, proposal);
    expect(request.ok).toBe(true);
    expect(areAllied(request.state, "human", "bot")).toBe(false);
    expect(applyCommand(request.state, proposal).ok).toBe(false);
    expect(applyCommand(request.state, { type: "trade", player: "human", from, to }).ok).toBe(false);
    const waiting = advance(forceRoll(request.state, 0), 4);
    expect(areAllied(waiting, "human", "bot")).toBe(false);
    const accepted = advance(waiting, 1);
    expect(accepted.diplomacyResults?.[0].accepted).toBe(true);
    expect(areAllied(accepted, "human", "bot")).toBe(true);
    expect(applyCommand(accepted, { type: "trade", player: "human", from, to }).ok).toBe(true);
  });
  it("rejects even an equal nation and allows a later new attempt", () => {
    const game = createInitialGame();
    const request = applyCommand(game, proposal).state;
    const rejected = advance(forceRoll(request, .99), 5);
    expect(rejected.diplomacyResults?.[0].accepted).toBe(false);
    expect(areAllied(rejected, "human", "bot")).toBe(false);
    expect(applyCommand(rejected, proposal).ok).toBe(false);
    const retry = applyCommand(advance(rejected, 30), proposal);
    expect(retry.ok).toBe(true);
    expect(retry.state.allianceAttempts?.["bot:human"]).toBe(2);
    expect(advance(forceRoll(retry.state, 0), 5).diplomacyResults?.at(-1)?.accepted).toBe(true);
  });
  it("evaluates current strength at resolution and uses a reproducible roll", () => {
    const game = createInitialGame();
    expect(allianceRoll(27, "human", "bot", 1)).toBe(allianceRoll(27, "human", "bot", 1));
    expect(allianceRoll(27, "human", "bot", 1)).not.toBe(allianceRoll(27, "human", "bot", 2));
    expect(evaluateAlliance(game, "human", "bot", .49).accepted).toBe(true);
    expect(evaluateAlliance(game, "human", "bot", .51).accepted).toBe(false);
    const bot = game.map.territories.find(t => t.capitalFor === "bot")!.id;
    game.territories[bot].units = 100;
    expect(evaluateAlliance(game, "human", "bot", .4).accepted).toBe(false);
  });
  it("cancels pending proposals if a capital falls and resets on replay", () => {
    const game = applyCommand(createInitialGame(300, 27, "crownlands", 2), proposal).state;
    const bot = game.map.territories.find(t => t.capitalFor === "bot")!.id;
    const captured = { ...game, territories: { ...game.territories, [bot]: { ...game.territories[bot], owner: "bot-2" as const } } };
    const next = advanceGame(captured);
    expect(next.pendingAlliances).toHaveLength(0);
    expect(next.diplomacyResults?.[0].reason).toContain("cancelled");
    expect(areAllied(next, "human", "bot")).toBe(false);
    expect(createRematch(next).pendingAlliances ?? []).toHaveLength(0);
  });
});
