import { describe, expect, it } from "vitest";
import { chooseBotCommand } from "../bots/basicBot";
import { advanceGame, applyCommand, createInitialGame } from "./game";

describe("Frontier engine", () => {
  it("generates a deterministic fictional continent", () => {
    const first = createInitialGame(300, 77); const second = createInitialGame(300, 77);
    expect(first.map.territories).toEqual(second.map.territories);
    expect(first.map.territories).toHaveLength(32);
  });
  it("produces units for a capital-connected region", () => {
    let state = createInitialGame(); const capital = state.map.territories.find((territory) => territory.capitalFor === "human")!;
    state = advanceGame(advanceGame(advanceGame(state)));
    expect(state.territories[capital.id].units).toBe(13);
    expect(state.territories[capital.id].population).toBe(223);
  });
  it("selects a legal opening move for the normal bot", () => {
    const state = createInitialGame(); const command = chooseBotCommand(state, "normal");
    expect(command?.player).toBe("bot"); expect(command?.type).toBe("expand");
  });
  it("moves troops when attacking a neighbouring region", () => {
    const state = createInitialGame(); const capital = state.map.territories.find((territory) => territory.capitalFor === "human")!; const target = capital.neighbours[0];
    const result = applyCommand(state, { type: "expand", player: "human", from: capital.id, to: target });
    expect(result.ok).toBe(true); expect(result.state.events[0].movement?.to).toBe(target);
  });
  it("opens a trade route and delivers population on production ticks", () => {
    const initial = createInitialGame();
    const capital = initial.map.territories.find((territory) => territory.capitalFor === "human")!;
    const destination = capital.neighbours[0];
    const expansion = applyCommand(initial, { type: "expand", player: "human", from: capital.id, to: destination });
    expect(expansion.ok).toBe(true);
    if (!expansion.ok) return;
    const trade = applyCommand(expansion.state, { type: "trade", player: "human", from: capital.id, to: destination });
    expect(trade.ok).toBe(true);
    if (!trade.ok) return;
    const before = trade.state.territories[destination].population;
    const after = advanceGame(advanceGame(advanceGame(trade.state)));
    expect(after.tradeRoutes).toHaveLength(1);
    expect(after.territories[destination].population).toBe(before + 3);
  });
});
