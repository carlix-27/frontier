import { describe, expect, it } from "vitest";
import { applyCommand, createInitialGame } from "./game";
import { directAttack } from "./directAttack";

describe("direct province attacks", () => {
  it("selects the strongest connected garrison and leaves defenders behind", () => {
    const game = createInitialGame();
    const target = game.map.territories.find(t => !t.capitalFor)!;
    const origins = game.map.territories.filter(t => t.id !== target.id).slice(0, 3);
    origins.forEach((province, i) => {
      province.neighbours = i < 2 ? [target.id] : [];
      province.seaNeighbours = [];
      game.territories[province.id] = { ...game.territories[province.id], owner: "human", units: [12, 20, 100][i] };
    });
    for (const province of game.map.territories.filter(t => !origins.includes(t))) game.territories[province.id].owner = null;
    expect(directAttack(game, "human", target.id, 25)).toMatchObject({ from: origins[1].id, units: 5 });
    expect(directAttack(game, "human", target.id, 100)?.units).toBe(19);
  });
  it("supports sea attacks and rejects unreachable or empty origins", () => {
    const game = createInitialGame();
    const source = game.map.territories.find(t => t.capitalFor === "human")!;
    const target = game.map.territories.find(t => t.island)!;
    source.seaNeighbours = [target.id];
    const command = directAttack(game, "human", target.id, 50)!;
    expect(command).toMatchObject({ from: source.id, units: 6 });
    expect(applyCommand(game, command).state.invasions).toHaveLength(1);
    game.territories[source.id].units = 1;
    expect(directAttack(game, "human", target.id, 50)).toBeNull();
    source.seaNeighbours = [];
    expect(directAttack(game, "human", target.id, 50)).toBeNull();
  });
});
