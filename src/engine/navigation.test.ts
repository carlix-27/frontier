import { describe, expect, it } from "vitest";
import { createInitialGame, applyCommand, advanceGame } from "./game";
import { directAttack } from "./directAttack";
import { canSail } from "./navigation";

describe("island expeditions", () => {
  it("attacks an island outside the predefined lanes and waits for the ship to land", () => {
    const game = createInitialGame();
    const from = game.map.territories.find(t => t.island)!;
    const to = game.map.territories.find(t => t.island && t.id !== from.id && !from.seaNeighbours.includes(t.id))!;
    game.territories[from.id] = { ...game.territories[from.id], owner: "human", units: 20 };
    const command = directAttack(game, "human", to.id, 75)!;
    // Give the player only this island as a viable departure port.
    for (const t of Object.values(game.territories)) if (t.owner === "human" && t !== game.territories[from.id]) t.units = 1;
    const attack = directAttack(game, "human", to.id, 75)!;
    expect(command).not.toBeNull();
    expect(attack.from).toBe(from.id);
    expect(canSail(game.map, to, from)).toBe(true);
    const launched = applyCommand(game, attack);
    expect(launched.ok).toBe(true);
    expect(launched.state.invasions[0]).toMatchObject({ from: from.id, to: to.id, units: 15, launchedTick: 0, arrivalTick: 3 });
    const travelling = advanceGame(advanceGame(launched.state));
    expect(travelling.territories[to.id].owner).toBeNull();
    expect(travelling.invasions).toHaveLength(1);
    expect(advanceGame(travelling).territories[to.id].owner).toBe("human");
  });
  it("finds coastal provinces on multi-province islands without exposing inland provinces", () => {
    const game = createInitialGame(300, 842, "four-kingdoms");
    const island = game.map.territories.find(t => t.island)!;
    const coastal = game.map.territories.find(t => !t.island && !island.seaNeighbours.includes(t.id) && canSail(game.map, island, t))!;
    expect(coastal).toBeDefined();
    expect(canSail(game.map, coastal, island)).toBe(true);
    expect(canSail(game.map, coastal, coastal)).toBe(false);
    const classic = createInitialGame();
    const port = classic.map.territories.find(t => t.island)!;
    const inland = classic.map.territories.find(t => !t.island && !t.seaNeighbours.length && !canSail(classic.map, port, t));
    expect(inland).toBeDefined();
    expect(canSail(classic.map, port, inland!)).toBe(false);
  });
});
