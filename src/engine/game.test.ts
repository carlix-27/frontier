import { describe, expect, it } from "vitest";
import { chooseBotCommand } from "../bots/basicBot";
import { advanceGame, applyCommand, createInitialGame, createRematch } from "./game";
import { linkId, MAP_PRESETS } from "./map";
import { areAllied } from "./diplomacy";
import { getBotIds, getMatchPlayers, getPlayerColor, isPlayerAlive } from "./players";

describe("Frontier engine", () => {
  it("restarts a finished match with the same map, duration, and bot count", () => {
    const original = createInitialGame(600, 81, "shattered-coast", 6);
    const finished = { ...advanceGame(original), winner: "bot" as const };
    const rematch = createRematch(finished);
    expect(rematch.tick).toBe(0);
    expect(rematch.winner).toBeNull();
    expect(rematch.maxTicks).toBe(600);
    expect(rematch.map).toEqual(original.map);
    expect(getMatchPlayers(rematch)).toHaveLength(7);
    expect(rematch.roadLinks).toEqual([]);
  });
  it("requires an alliance for international trade and rewards both nations", () => {
    const initial = createInitialGame();
    const human = initial.map.territories.find((territory) => territory.capitalFor === "human")!;
    const bot = initial.map.territories.find((territory) => territory.capitalFor === "bot")!;
    const route = { type: "trade" as const, player: "human" as const, from: human.id, to: bot.id };
    expect(applyCommand(initial, route).ok).toBe(false);
    const pact = applyCommand(initial, { type: "ally", player: "human", with: "bot" });
    expect(pact.ok).toBe(true);
    if (!pact.ok) return;
    expect(areAllied(pact.state, "human", "bot")).toBe(true);
    const trade = applyCommand(pact.state, route);
    expect(trade.ok).toBe(true);
    if (!trade.ok) return;
    const delivered = advanceGame(advanceGame(advanceGame(trade.state)));
    expect(delivered.tradeCredits.human).toBe(2);
    expect(delivered.tradeCredits.bot).toBe(2);
    expect(delivered.territories[human.id].population).toBeGreaterThan(trade.state.territories[human.id].population);
    expect(delivered.territories[bot.id].population).toBeGreaterThan(trade.state.territories[bot.id].population);
    const ended = applyCommand(delivered, { type: "endAlliance", player: "human", with: "bot" });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.state.tradeRoutes).toHaveLength(0);
    expect(areAllied(ended.state, "human", "bot")).toBe(false);
    expect(applyCommand(ended.state, route).ok).toBe(false);
  });
  it("does not redirect an existing trade route to a new occupier", () => {
    const initial = createInitialGame(300, 27, "crownlands", 2);
    const human = initial.map.territories.find((territory) => territory.capitalFor === "human")!;
    const red = initial.map.territories.find((territory) => territory.capitalFor === "bot")!;
    const pact = applyCommand(initial, { type: "ally", player: "human", with: "bot" });
    expect(pact.ok).toBe(true);
    if (!pact.ok) return;
    const trade = applyCommand(pact.state, { type: "trade", player: "human", from: human.id, to: red.id });
    expect(trade.ok).toBe(true);
    if (!trade.ok) return;
    const newPact = applyCommand(trade.state, { type: "ally", player: "human", with: "bot-2" });
    expect(newPact.ok).toBe(true);
    if (!newPact.ok) return;
    const occupied = { ...newPact.state, territories: { ...newPact.state.territories, [red.id]: { ...newPact.state.territories[red.id], owner: "bot-2" as const } } };
    const after = advanceGame(advanceGame(advanceGame(occupied)));
    expect(after.tradeCredits.human).toBe(0);
    expect(after.tradeCredits["bot-2"]).toBe(0);
  });
  it("prevents attacks on allied provinces until the alliance ends", () => {
    const initial = createInitialGame();
    const human = initial.map.territories.find((territory) => territory.capitalFor === "human")!;
    const neighbor = human.neighbours.find((id) => initial.territories[id].owner === null)!;
    const state = { ...initial, territories: { ...initial.territories, [neighbor]: { ...initial.territories[neighbor], owner: "bot" as const } } };
    const pact = applyCommand(state, { type: "ally", player: "human", with: "bot" });
    expect(pact.ok).toBe(true);
    if (!pact.ok) return;
    expect(applyCommand(pact.state, { type: "expand", player: "human", from: human.id, to: neighbor, units: 5 }).ok).toBe(false);
    const ended = applyCommand(pact.state, { type: "endAlliance", player: "human", with: "bot" });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(applyCommand(ended.state, { type: "expand", player: "human", from: human.id, to: neighbor, units: 5 }).ok).toBe(true);
  });
  it("keeps a built road after its provinces change hands", () => {
    const initial = createInitialGame();
    const capital = initial.map.territories.find((territory) => territory.capitalFor === "human")!;
    const target = capital.neighbours.find((id) => initial.territories[id].owner === null)!;
    const captured = applyCommand(initial, { type: "expand", player: "human", from: capital.id, to: target, units: 5 });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const road = linkId(capital.id, target);
    expect(captured.state.roadLinks).toEqual([road]);
    const changedOwner = { ...captured.state, territories: { ...captured.state.territories, [target]: { ...captured.state.territories[target], owner: "bot" as const } } };
    expect(advanceGame(changedOwner).roadLinks).toContain(road);
  });
  it("creates up to eight distinct bot capitals with separate colors and credits", () => {
    const game = createInitialGame(300, 27, "crownlands", 8);
    const players = getMatchPlayers(game);
    expect(players).toHaveLength(9);
    expect(new Set(game.map.territories.filter((territory) => territory.capitalFor).map((territory) => territory.id)).size).toBe(9);
    expect(new Set(players.map(getPlayerColor)).size).toBe(9);
    expect(Object.keys(game.tradeCredits)).toHaveLength(9);
    for (const player of getBotIds(8)) {
      expect(isPlayerAlive(game, player)).toBe(true);
      expect(chooseBotCommand(game, "normal", player)).not.toBeNull();
    }
  });
  it("eliminates a bot when its capital falls and keeps the other bots playing", () => {
    const game = createInitialGame(300, 27, "crownlands", 3);
    const capital = game.map.territories.find((territory) => territory.capitalFor === "bot")!;
    const territories = { ...game.territories, [capital.id]: { ...game.territories[capital.id], owner: "human" as const } };
    const after = advanceGame({ ...game, territories });
    expect(after.winner).toBeNull();
    expect(isPlayerAlive(after, "bot")).toBe(false);
    expect(chooseBotCommand(after, "normal", "bot")).toBeNull();
    expect(applyCommand(after, { type: "fortify", player: "bot", territory: capital.id }).ok).toBe(false);
  });
  it("declares the sole surviving capital owner the winner", () => {
    const game = createInitialGame(300, 27, "crownlands", 3);
    const territories = { ...game.territories };
    for (const capital of game.map.territories.filter((territory) => territory.capitalFor && territory.capitalFor !== "human")) {
      territories[capital.id] = { ...territories[capital.id], owner: "human" };
    }
    expect(advanceGame({ ...game, territories }).winner).toBe("human");
  });
  it("generates a deterministic fictional continent", () => {
    const first = createInitialGame(300, 77); const second = createInitialGame(300, 77);
    expect(first.map.territories).toEqual(second.map.territories);
    expect(first.map.territories).toHaveLength(50);
  });
  it("generates all five selectable coastlines with valid capitals", () => {
    const maps = MAP_PRESETS.filter(preset => !preset.generation).map((preset) => createInitialGame(300, preset.seed, preset.id).map);
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
  it("draws on friendly roads for troop transfers without fighting allies", () => {
    const initial = createInitialGame();
    const capital = initial.map.territories.find((territory) => territory.capitalFor === "human")!;
    const destination = capital.neighbours[0];
    const territories = { ...initial.territories, [destination]: { ...initial.territories[destination], owner: "human" as const, units: 7 } };
    const result = applyCommand({ ...initial, territories }, { type: "expand", player: "human", from: capital.id, to: destination, units: 4 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.territories[capital.id].units).toBe(8);
    expect(result.state.territories[destination].units).toBe(11);
    expect(result.state.events[0].movement?.byRoad).toBe(true);
  });
  it("gives an attacker with an allied road a small combat advantage", () => {
    const initial = createInitialGame();
    const capital = initial.map.territories.find((territory) => territory.capitalFor === "human")!;
    const ally = capital.neighbours[0];
    const enemy = capital.neighbours.find((id) => id !== ally)!;
    const territories = { ...initial.territories, [ally]: { ...initial.territories[ally], owner: "human" as const }, [capital.id]: { ...initial.territories[capital.id], units: 5 }, [enemy]: { ...initial.territories[enemy], units: 3 } };
    const withoutRoad = applyCommand({ ...initial, territories: { ...territories, [ally]: { ...territories[ally], owner: null } } }, { type: "expand", player: "human", from: capital.id, to: enemy, units: 3 });
    const withRoad = applyCommand({ ...initial, territories }, { type: "expand", player: "human", from: capital.id, to: enemy, units: 3 });
    expect(withoutRoad.state.territories[enemy].owner).toBeNull();
    expect(withRoad.state.territories[enemy].owner).toBe("human");
  });
  it("reaches a decisive result faster in a normal bot demonstration", () => {
    let state = createInitialGame(300);
    for (let tick = 0; tick < 180 && !state.winner; tick += 1) {
      state = advanceGame(state);
      for (const player of ["human", "bot"] as const) for (let action = 0; action < 3 && !state.winner; action += 1) {
        const command = chooseBotCommand(state, "normal", player);
        if (!command) break;
        const result = applyCommand(state, command);
        if (!result.ok) break;
        state = result.state;
      }
    }
    expect(state.winner).not.toBeNull();
    expect(state.tick).toBeLessThan(90);
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
