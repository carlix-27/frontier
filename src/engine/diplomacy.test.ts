import { describe, expect, it } from "vitest";
import { applyCommand, createInitialGame } from "./game";
import { areAllied } from "./diplomacy";

describe("bot alliance proposals", () => {
  it("accepts an equally strong partner and enables trading and protection", () => {
    const game = createInitialGame();
    const result = applyCommand(game, { type: "ally", player: "human", with: "bot" });
    expect(result.ok).toBe(true);
    expect(result.state.events[0].diplomacy?.accepted).toBe(true);
    expect(areAllied(result.state, "human", "bot")).toBe(true);
    const from = game.map.territories.find(t => t.capitalFor === "human")!.id;
    const to = game.map.territories.find(t => t.capitalFor === "bot")!.id;
    expect(applyCommand(result.state, { type: "trade", player: "human", from, to }).ok).toBe(true);
  });
  it("rejects a weak proposer, blocks trade and applies a game-time cooldown", () => {
    const game = createInitialGame();
    const bot = game.map.territories.find(t => t.capitalFor === "bot")!.id;
    const human = game.map.territories.find(t => t.capitalFor === "human")!.id;
    game.territories[bot].units = 100;
    const proposal = { type: "ally" as const, player: "human" as const, with: "bot" as const };
    const rejected = applyCommand(game, proposal);
    expect(rejected.ok).toBe(true);
    expect(rejected.state.events[0].diplomacy?.accepted).toBe(false);
    expect(areAllied(rejected.state, "human", "bot")).toBe(false);
    expect(applyCommand(rejected.state, { type: "trade", player: "human", from: human, to: bot }).ok).toBe(false);
    const retry = applyCommand(rejected.state, proposal);
    expect(retry.ok).toBe(false);
    if (!retry.ok) expect(retry.reason).toContain("30 game seconds");
    const changed = { ...rejected.state, tick: 30, territories: { ...rejected.state.territories, [human]: { ...rejected.state.territories[human], units: 100 } } };
    const accepted = applyCommand(changed, proposal);
    expect(accepted.state.events[0].diplomacy?.accepted).toBe(true);
    expect(areAllied(accepted.state, "human", "bot")).toBe(true);
  });
  it("refuses invalid proposals without changing state", () => {
    const game = createInitialGame();
    const result = applyCommand(game, { type: "ally", player: "human", with: "human" });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(game);
  });
});
