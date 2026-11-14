import { describe, expect, it } from "vitest";
import { chooseBotCommand } from "../bots/basicBot";
import { advanceGame, applyCommand, createInitialGame } from "./game";

describe("Frontier engine", () => {
  it("captures a neutral territory when the attacking force is stronger", () => {
    const state = createInitialGame();
    const result = applyCommand(state, { type: "expand", player: "human", from: "harbor", to: "ridge" });

    expect(result.ok).toBe(true);
    expect(result.state.territories.ridge.owner).toBe("human");
    expect(result.state.territories.ridge.units).toBe(4);
  });

  it("produces units for a territory connected to its capital", () => {
    let state = createInitialGame();
    state = advanceGame(state);
    state = advanceGame(state);
    state = advanceGame(state);

    expect(state.territories.harbor.units).toBe(13);
  });

  it("selects a legal opening move for the normal bot", () => {
    const command = chooseBotCommand(createInitialGame(), "normal");

    expect(command).toEqual({ type: "expand", player: "bot", from: "citadel", to: "heights" });
  });
});
