import { describe, expect, it } from "vitest";
import { chooseBotCommand } from "../bots/basicBot";
import { advanceGame, applyCommand, createInitialGame } from "./game";
import { MAP_PRESETS } from "./map";

describe("Frontier engine", () => {
  it("generates a deterministic fictional continent", () => {
    const first = createInitialGame(300, 77); const second = createInitialGame(300, 77);
    expect(first.map.territories).toEqual(second.map.territories);
    expect(first.map.territories).toHaveLength(50);
  });
  it("generates all five selectable coastlines with valid capitals", () => {
    const maps = MAP_PRESETS.map((preset) => createInitialGame(300, preset.seed, preset.id).map);
    expect(new Set(maps.map((map) => map.landPath)).size).toBe(5);
    for (const map of maps) {
      expect(map.territories).toHaveLength(50);
      const islands = map.territories.filter((region) => region.island);
      expect(islands).toHaveLength(18);
      for (const island of islands) {
        expect(island.seaNeighbours.length).toBeGreaterThanOrEqual(2);
        for (const neighbor of island.seaNeighbours) expect(map.territories.find((region) => region.id === neighbor)?.seaNeighbours).toContain(island.id);
      }
      expect(map.territories.filter((region) => region.capitalFor)).toHaveLength(2);
      const capital = map.territories.find((region) => region.capitalFor === "human")!;
      const reachable = new Set([capital.id]);
      const queue = [capital.id];
      while (queue.length) {
        const id = queue.shift()!;
        const current = map.territories.find((region) => region.id === id);
        if (!current) throw new Error(`Missing province ${id} in ${map.id}`);
        for (const neighbor of [...current.neighbours, ...current.seaNeighbours]) if (!reachable.has(neighbor)) { reachable.add(neighbor); queue.push(neighbor); }
      }
      expect(reachable.size).toBe(map.territories.length);
    }
  });
  it("requires prerequisites and credits for province population upgrades", () => {
    const initial = createInitialGame();
    const capital = initial.map.territories.find((territory) => territory.capitalFor === "human")!;
    const funded = { ...initial, tradeCredits: { ...initial.tradeCredits, human: 12 } };
    expect(applyCommand(funded, { type: "upgrade", player: "human", territory: capital.id, upgrade: "industry" }).ok).toBe(false);
    const housing = applyCommand(funded, { type: "upgrade", player: "human", territory: capital.id, upgrade: "housing" });
    expect(housing.ok).toBe(true);
    if (!housing.ok) return;
    expect(housing.state.tradeCredits.human).toBe(9);
    const industry = applyCommand(housing.state, { type: "upgrade", player: "human", territory: capital.id, upgrade: "industry" });
    expect(industry.ok).toBe(true);
    if (!industry.ok) return;
    expect(advanceGame(advanceGame(advanceGame(industry.state))).territories[capital.id].units).toBe(14);
  });
  it("grows population in a capital with initial housing", () => {
    let state = createInitialGame(); const capital = state.map.territories.find((territory) => territory.capitalFor === "human")!;
    state = advanceGame(advanceGame(advanceGame(state)));
    expect(state.territories[capital.id].units).toBe(13);
    expect(state.territories[capital.id].population).toBe(225);
  });
  it("selects a legal opening move for the normal bot", () => {
    const state = createInitialGame(); const command = chooseBotCommand(state, "normal");
    expect(command?.player).toBe("bot"); expect(command?.type).toBe("expand");
  });
  it("selects a legal opening move for the blue commander", () => {
    const state = createInitialGame(); const command = chooseBotCommand(state, "normal", "human");
    expect(command?.player).toBe("human"); expect(command?.type).toBe("expand");
  });
  it("moves troops when attacking a neighbouring region", () => {
    const state = createInitialGame(); const capital = state.map.territories.find((territory) => territory.capitalFor === "human")!; const target = capital.neighbours[0];
    const result = applyCommand(state, { type: "expand", player: "human", from: capital.id, to: target });
    expect(result.ok).toBe(true); expect(result.state.events[0].movement?.to).toBe(target);
  });
  it("lets both sides conquer reachable islands by ship and grow connected populations", () => {
    for (const player of ["human", "bot"] as const) {
      const initial = createInitialGame();
      const island = initial.map.territories.find((region) => region.island)!;
      const port = island.seaNeighbours.map((id) => initial.map.territories.find((region) => region.id === id)!).find((region) => !region.island && (!region.capitalFor || region.capitalFor === player))!;
      const territories = Object.fromEntries(Object.entries(initial.territories).map(([id, territory]) => { const definition = initial.map.territories.find((region) => region.id === id)!; return [id, { ...territory, owner: id === island.id ? null : definition.capitalFor && definition.capitalFor !== player ? definition.capitalFor : player, units: id === port.id ? 20 : territory.units }]; })) as typeof initial.territories;
      const state = { ...initial, territories };
      const result = applyCommand(state, { type: "expand", player, from: port.id, to: island.id, units: 8 });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.state.territories[island.id].owner).toBeNull();
      expect(result.state.invasions).toHaveLength(1);
      expect(result.state.events[0].movement?.bySea).toBe(true);
      const landed = advanceGame(result.state);
      expect(landed.invasions).toHaveLength(0);
      expect(landed.territories[island.id].owner).toBe(player);
      expect(landed.events[0].capture?.territory).toBe(island.id);
      expect(applyCommand(landed, { type: "supply", player, from: port.id, to: island.id }).ok).toBe(false);
      const before = landed.territories[island.id].population;
      const after = advanceGame(advanceGame(landed));
      expect(after.territories[island.id].population).toBeGreaterThan(before);
    }
  });
  it("lets bots reach the islands during a local demonstration", () => {
    let state = createInitialGame(180);
    for (let tick = 0; tick < 180 && !state.winner; tick += 1) {
      state = advanceGame(state);
      if (state.tick % 3 !== 0 || state.winner) continue;
      for (const player of ["human", "bot"] as const) {
        const command = chooseBotCommand(state, "normal", player);
        if (command) { const result = applyCommand(state, command); if (result.ok) state = result.state; }
      }
    }
    expect(state.map.territories.filter((region) => region.island && state.territories[region.id].owner)).not.toHaveLength(0);
  });
  it("allows the player to choose a smaller attack force", () => {
    const state = createInitialGame(); const capital = state.map.territories.find((territory) => territory.capitalFor === "human")!; const target = capital.neighbours[0];
    const result = applyCommand(state, { type: "expand", player: "human", from: capital.id, to: target, units: 3 });
    expect(result.ok).toBe(true);
    expect(result.state.territories[capital.id].units).toBe(9);
    expect(result.state.events[0].movement?.units).toBe(3);
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
    expect(after.tradeCredits.human).toBe(2);
  });
  it("spends trade credits to build a factory with a production bonus", () => {
    const initial = createInitialGame(); const capital = initial.map.territories.find((territory) => territory.capitalFor === "human")!;
    const state = { ...initial, tradeCredits: { ...initial.tradeCredits, human: 7 } };
    const construction = applyCommand(state, { type: "build", player: "human", territory: capital.id, building: "factory" });
    expect(construction.ok).toBe(true);
    if (!construction.ok) return;
    expect(construction.state.tradeCredits.human).toBe(0);
    const after = advanceGame(advanceGame(advanceGame(construction.state)));
    expect(after.territories[capital.id].units).toBe(14);
    expect(applyCommand(after, { type: "build", player: "human", territory: capital.id, building: "factory" }).ok).toBe(false);
  });
});
