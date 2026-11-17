import { generateFrontierMap, getTerritory, linkId } from "./map";
import { getMatchPlayers, getPlayerName, isPlayerAlive } from "./players";
import type { BuildingType, CommandResult, GameCommand, GameState, PlayerId, PopulationUpgrade, TerritoryId, TerritoryState } from "./types";

const PRODUCTION_INTERVAL = 3;
const MAX_FORTIFICATION = 3;
const EVENT_LIMIT = 8;
export const BUILDING_COSTS: Record<BuildingType, number> = { housing: 4, factory: 7, railway: 5 };
export const BUILDING_NAMES: Record<BuildingType, string> = { housing: "Housing district", factory: "Factory", railway: "Railway" };
export const UPGRADE_NAMES: Record<PopulationUpgrade, string> = { housing: "Neighborhoods", industry: "Workshops", militia: "Civil guard" };
export function upgradeCost(level: number): number { return 3 + level * 3; }

function copyTerritories(territories: GameState["territories"]): GameState["territories"] {
  return Object.fromEntries(Object.entries(territories).map(([id, territory]) => [id, { ...territory }])) as Record<TerritoryId, TerritoryState>;
}

function withEvent(state: GameState, message: string, movement?: GameState["events"][number]["movement"], capture?: GameState["events"][number]["capture"]): GameState {
  return { ...state, events: [{ tick: state.tick, message, movement, capture }, ...state.events].slice(0, EVENT_LIMIT) };
}

function capitalId(state: GameState, player: PlayerId): TerritoryId {
  const capital = state.map.territories.find((territory) => territory.capitalFor === player);
  if (!capital) throw new Error(`Missing ${player} capital.`);
  return capital.id;
}

function isConnectedToCapital(state: GameState, territoryId: TerritoryId, player: PlayerId): boolean {
  if (!isPlayerAlive(state, player)) return false;
  const capital = capitalId(state, player);
  const visited = new Set<TerritoryId>([capital]);
  const queue = [capital];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current === territoryId) return true;
    const definition = getTerritory(state.map, current);
    for (const neighbour of [...definition.neighbours, ...definition.seaNeighbours]) {
      if (!visited.has(neighbour) && state.territories[neighbour].owner === player) { visited.add(neighbour); queue.push(neighbour); }
    }
  }
  return false;
}

function controlScore(state: GameState, player: PlayerId): number {
  return Object.values(state.territories).reduce((total, territory) => total + (territory.owner === player ? 1 + territory.fortification : 0), 0);
}

export function getPopulation(state: GameState, player: PlayerId): number {
  return Object.values(state.territories).reduce((total, territory) => total + (territory.owner === player ? territory.population : 0), 0);
}

export function createInitialGame(maxTicks = 300, seed = 27, presetId = "crownlands", botCount = 1): GameState {
  const map = generateFrontierMap(seed, presetId, botCount);
  const territories = Object.fromEntries(map.territories.map((territory) => [territory.id, { owner: territory.capitalFor ?? null, units: territory.capitalFor ? 12 : 2, population: territory.capitalFor ? 220 : 40, fortification: territory.capitalFor ? 1 : 0, buildings: territory.capitalFor ? ["housing"] : [], upgrades: {} }])) as Record<TerritoryId, TerritoryState>;
  const tradeCredits = Object.fromEntries(map.territories.filter((territory) => territory.capitalFor).map((territory) => [territory.capitalFor, 0])) as Record<PlayerId, number>;
  return { tick: 0, maxTicks, map, territories, suppliedLinks: [], tradeRoutes: [], invasions: [], tradeCredits, events: [{ tick: 0, message: "Secure your capital, then claim the frontier." }], winner: null };
}

export function applyCommand(state: GameState, command: GameCommand): CommandResult {
  if (state.winner) return { ok: false, state, reason: "The match is already over." };
  if (!isPlayerAlive(state, command.player)) return { ok: false, state, reason: "Your capital has fallen. You can spectate the remaining players." };
  const territories = copyTerritories(state.territories);
  if (command.type === "upgrade") {
    const territory = territories[command.territory];
    if (!territory || territory.owner !== command.player) return { ok: false, state, reason: "Manage population only in your territories." };
    const level = territory.upgrades[command.upgrade] ?? 0;
    if (level >= 3) return { ok: false, state, reason: "This branch is fully developed." };
    if (command.upgrade === "industry" && (territory.upgrades.housing ?? 0) < 1) return { ok: false, state, reason: "Build Neighborhoods I first." };
    if (command.upgrade === "militia" && (territory.upgrades.industry ?? 0) < 1) return { ok: false, state, reason: "Build Workshops I first." };
    const cost = upgradeCost(level);
    if (state.tradeCredits[command.player] < cost) return { ok: false, state, reason: `You need ${cost} trade credits.` };
    territory.upgrades = { ...territory.upgrades, [command.upgrade]: level + 1 };
    return { ok: true, state: withEvent({ ...state, territories, tradeCredits: { ...state.tradeCredits, [command.player]: state.tradeCredits[command.player] - cost } }, `${command.player} improved ${UPGRADE_NAMES[command.upgrade]} in ${getTerritory(state.map, command.territory).label}.`) };
  }
  if (command.type === "build") {
    const territory = territories[command.territory];
    if (!territory || territory.owner !== command.player) return { ok: false, state, reason: "Build only in one of your territories." };
    if (territory.buildings.includes(command.building)) return { ok: false, state, reason: "That territory already has this infrastructure." };
    const cost = BUILDING_COSTS[command.building];
    if (state.tradeCredits[command.player] < cost) return { ok: false, state, reason: `You need ${cost} trade credits.` };
    territory.buildings = [...territory.buildings, command.building];
    return { ok: true, state: withEvent({ ...state, territories, tradeCredits: { ...state.tradeCredits, [command.player]: state.tradeCredits[command.player] - cost } }, `${command.player} built ${BUILDING_NAMES[command.building]} in ${getTerritory(state.map, command.territory).label}.`) };
  }
  if (command.type === "fortify") {
    const territory = territories[command.territory];
    if (!territory || territory.owner !== command.player) return { ok: false, state, reason: "Choose one of your territories." };
    if (territory.units < 3) return { ok: false, state, reason: "Fortify requires 3 units." };
    if (territory.fortification >= MAX_FORTIFICATION) return { ok: false, state, reason: "That territory is fully fortified." };
    territory.units -= 2; territory.fortification += 1;
    return { ok: true, state: withEvent({ ...state, territories }, `${command.player} fortified ${getTerritory(state.map, command.territory).label}.`) };
  }
  if (command.type === "trade") {
    if (command.from === command.to) return { ok: false, state, reason: "Trade needs two different ports." };
    const source = territories[command.from]; const target = territories[command.to];
    if (source.owner !== command.player || target.owner !== command.player) return { ok: false, state, reason: "Trade routes connect two of your territories." };
    const id = linkId(command.from, command.to);
    if (state.tradeRoutes.some((route) => route.id === id && route.player === command.player)) return { ok: false, state, reason: "That trade route already exists." };
    return { ok: true, state: withEvent({ ...state, tradeRoutes: [...state.tradeRoutes, { id, from: command.from, to: command.to, player: command.player }] }, `${command.player} opened a maritime trade route.`) };
  }
  const origin = getTerritory(state.map, command.from);
  const bySea = origin.seaNeighbours.includes(command.to);
  if (!origin.neighbours.includes(command.to) && !bySea) return { ok: false, state, reason: "Those territories have no shared frontier or sea route." };
  const source = territories[command.from]; const target = territories[command.to];
  if (source.owner !== command.player) return { ok: false, state, reason: "Choose one of your territories first." };
  if (command.type === "supply") {
    if (bySea) return { ok: false, state, reason: "Supply routes require a shared land frontier. Islands receive supplies by sea while connected to your capital." };
    if (target.owner !== command.player) return { ok: false, state, reason: "Supply routes connect friendly territories." };
    const route = linkId(command.from, command.to);
    if (state.suppliedLinks.includes(route)) return { ok: false, state, reason: "That supply route is already active." };
    if (source.units < 4) return { ok: false, state, reason: "Supply routes require 4 units." };
    source.units -= 3; target.units += 1;
    return { ok: true, state: withEvent({ ...state, territories, suppliedLinks: [...state.suppliedLinks, route] }, `${command.player} opened a supply route to ${getTerritory(state.map, command.to).label}.`) };
  }
  if (source.units < 2) return { ok: false, state, reason: "Keep at least one unit behind to defend the territory." };
  const attackers = command.units ?? Math.floor(source.units / 2);
  if (!Number.isInteger(attackers) || attackers < 1 || attackers >= source.units) return { ok: false, state, reason: "Choose a whole number of units and leave at least one behind." };
  source.units -= attackers;
  const byRoad = !bySea && target.owner === command.player;
  const roadSupport = !bySea && origin.neighbours.some((neighbour) => territories[neighbour].owner === command.player);
  const defence = target.units + target.fortification * 2;
  const movement = { from: command.from, to: command.to, player: command.player, units: attackers, bySea, byRoad };
  if (bySea) {
    const invasion = { from: command.from, to: command.to, player: command.player, units: attackers, arrivalTick: state.tick + 1 };
    return { ok: true, state: withEvent({ ...state, territories, invasions: [...state.invasions, invasion] }, `${command.player} launched ${attackers} units by sea toward ${getTerritory(state.map, command.to).label}.`, movement) };
  }
  if (target.owner === command.player) {
    target.units += attackers;
    return { ok: true, state: withEvent({ ...state, territories }, `${command.player} moved ${attackers} units along the road to ${getTerritory(state.map, command.to).label}.`, movement) };
  }
  const attackPower = attackers + (roadSupport ? 1 : 0);
  if (attackPower > defence) {
    const previousOwner = target.owner; target.owner = command.player; target.units = Math.max(1, attackPower - defence); target.population = Math.max(12, Math.floor(target.population * 0.78)); target.fortification = 0;
    const message = previousOwner ? `${command.player} captured ${getTerritory(state.map, command.to).label}.` : `${command.player} claimed ${getTerritory(state.map, command.to).label}.`;
    return { ok: true, state: withEvent({ ...state, territories }, message, movement, { territory: command.to, from: command.from, player: command.player, previousOwner }) };
  }
  target.units = Math.max(1, defence - attackPower);
  return { ok: true, state: withEvent({ ...state, territories }, `${command.player}'s attack was repelled.`, movement) };
}

export function advanceGame(state: GameState): GameState {
  if (state.winner) return state;
  let next: GameState = { ...state, tick: state.tick + 1, territories: copyTerritories(state.territories), tradeCredits: { ...state.tradeCredits } };
  if (next.tick % PRODUCTION_INTERVAL === 0) for (const definition of next.map.territories) {
    const territory = next.territories[definition.id];
    if (territory.owner && isConnectedToCapital(next, definition.id, territory.owner)) {
      territory.population += (definition.capitalFor ? 3 : 1) + (territory.buildings.includes("housing") ? 2 : 0) + (territory.buildings.includes("railway") ? 1 : 0) + (territory.upgrades.housing ?? 0);
      const supplyBonus = definition.neighbours.some((neighbour) => next.territories[neighbour].owner === territory.owner && next.suppliedLinks.includes(linkId(definition.id, neighbour))) ? 1 : 0;
      territory.units += 1 + supplyBonus + (territory.buildings.includes("factory") ? 1 : 0) + (territory.upgrades.industry ?? 0);
      territory.fortification = Math.min(MAX_FORTIFICATION, territory.fortification + ((territory.upgrades.militia ?? 0) >= 2 && next.tick % 9 === 0 ? 1 : 0));
    }
  }
  if (next.tick % PRODUCTION_INTERVAL === 0) for (const route of next.tradeRoutes) {
    if (next.territories[route.from].owner === route.player && next.territories[route.to].owner === route.player) { next.territories[route.to].population += 2; next.tradeCredits[route.player] += 2; }
  }
  const arrivals = next.invasions.filter((invasion) => invasion.arrivalTick <= next.tick);
  next.invasions = next.invasions.filter((invasion) => invasion.arrivalTick > next.tick);
  for (const invasion of arrivals) {
    if (!isPlayerAlive(next, invasion.player)) continue;
    const target = next.territories[invasion.to];
    if (target.owner === invasion.player) { target.units += invasion.units; next = withEvent(next, `${invasion.player} reinforced ${getTerritory(next.map, invasion.to).label} by sea.`); continue; }
    const defence = target.units + target.fortification * 2;
    if (invasion.units > defence) {
      const previousOwner = target.owner;
      target.owner = invasion.player; target.units = invasion.units - defence; target.population = Math.max(12, Math.floor(target.population * 0.78)); target.fortification = 0;
      next = withEvent(next, `${invasion.player} landed and captured ${getTerritory(next.map, invasion.to).label}.`, undefined, { territory: invasion.to, from: invasion.from, player: invasion.player, previousOwner });
    } else {
      target.units = Math.max(1, defence - invasion.units);
      next = withEvent(next, `${invasion.player}'s landing at ${getTerritory(next.map, invasion.to).label} was repelled.`);
    }
  }
  const activePlayers = getMatchPlayers(next).filter((player) => isPlayerAlive(next, player));
  if (activePlayers.length === 0) return withEvent({ ...next, winner: "draw" }, "No capitals remain. The match is a draw.");
  if (activePlayers.length === 1) return withEvent({ ...next, winner: activePlayers[0] }, `${getPlayerName(activePlayers[0])} controls the frontier.`);
  if (next.tick >= next.maxTicks) {
    const ranked = activePlayers.map((player) => ({ player, score: controlScore(next, player) })).sort((a, b) => b.score - a.score);
    const winner: PlayerId | "draw" = ranked[0].score === ranked[1].score ? "draw" : ranked[0].player;
    return withEvent({ ...next, winner }, winner === "draw" ? "Time expired. The match is a draw." : `Time expired. ${getPlayerName(winner)} controls the frontier.`);
  }
  return next;
}

export function getControlScore(state: GameState, player: PlayerId): number { return controlScore(state, player); }
