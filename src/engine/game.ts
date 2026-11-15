import { generateFrontierMap, getTerritory, linkId } from "./map";
import type { BuildingType, CommandResult, GameCommand, GameState, PlayerId, TerritoryId, TerritoryState } from "./types";

const PRODUCTION_INTERVAL = 3;
const MAX_FORTIFICATION = 3;
const EVENT_LIMIT = 8;
export const BUILDING_COSTS: Record<BuildingType, number> = { housing: 4, factory: 7, railway: 5 };
export const BUILDING_NAMES: Record<BuildingType, string> = { housing: "Housing district", factory: "Factory", railway: "Railway" };

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
  const capital = capitalId(state, player);
  const visited = new Set<TerritoryId>([capital]);
  const queue = [capital];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current === territoryId) return true;
    for (const neighbour of getTerritory(state.map, current).neighbours) {
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

export function createInitialGame(maxTicks = 300, seed = 27): GameState {
  const map = generateFrontierMap(seed);
  const territories = Object.fromEntries(map.territories.map((territory) => [territory.id, { owner: territory.capitalFor ?? null, units: territory.capitalFor ? 12 : 2, population: territory.capitalFor ? 220 : 40, fortification: territory.capitalFor ? 1 : 0, buildings: territory.capitalFor ? ["housing"] : [] }])) as Record<TerritoryId, TerritoryState>;
  return { tick: 0, maxTicks, map, territories, suppliedLinks: [], tradeRoutes: [], tradeCredits: { human: 0, bot: 0 }, events: [{ tick: 0, message: "Secure your capital, then claim the frontier." }], winner: null };
}

export function applyCommand(state: GameState, command: GameCommand): CommandResult {
  if (state.winner) return { ok: false, state, reason: "The match is already over." };
  const territories = copyTerritories(state.territories);
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
  if (!getTerritory(state.map, command.from).neighbours.includes(command.to)) return { ok: false, state, reason: "Those territories do not share a frontier." };
  const source = territories[command.from]; const target = territories[command.to];
  if (source.owner !== command.player) return { ok: false, state, reason: "Choose one of your territories first." };
  if (command.type === "supply") {
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
  const defence = target.units + target.fortification * 2;
  const movement = { from: command.from, to: command.to, player: command.player, units: attackers };
  if (attackers > defence) {
    const previousOwner = target.owner; target.owner = command.player; target.units = attackers - defence; target.population = Math.max(12, Math.floor(target.population * 0.78)); target.fortification = 0;
    const message = previousOwner ? `${command.player} captured ${getTerritory(state.map, command.to).label}.` : `${command.player} claimed ${getTerritory(state.map, command.to).label}.`;
    return { ok: true, state: withEvent({ ...state, territories }, message, movement, { territory: command.to, from: command.from, player: command.player, previousOwner }) };
  }
  target.units = Math.max(1, defence - attackers);
  return { ok: true, state: withEvent({ ...state, territories }, `${command.player}'s attack was repelled.`, movement) };
}

export function advanceGame(state: GameState): GameState {
  if (state.winner) return state;
  let next: GameState = { ...state, tick: state.tick + 1, territories: copyTerritories(state.territories), tradeCredits: { ...state.tradeCredits } };
  if (next.tick % PRODUCTION_INTERVAL === 0) for (const definition of next.map.territories) {
    const territory = next.territories[definition.id];
    if (territory.owner && isConnectedToCapital(next, definition.id, territory.owner)) {
      territory.population += (definition.capitalFor ? 3 : 1) + (territory.buildings.includes("housing") ? 2 : 0) + (territory.buildings.includes("railway") ? 1 : 0);
      const supplyBonus = definition.neighbours.some((neighbour) => next.suppliedLinks.includes(linkId(definition.id, neighbour))) ? 1 : 0;
      territory.units += 1 + supplyBonus + (territory.buildings.includes("factory") ? 1 : 0);
    }
  }
  if (next.tick % PRODUCTION_INTERVAL === 0) for (const route of next.tradeRoutes) {
    if (next.territories[route.from].owner === route.player && next.territories[route.to].owner === route.player) { next.territories[route.to].population += 2; next.tradeCredits[route.player] += 2; }
  }
  if (next.territories[capitalId(next, "human")].owner === "bot") return withEvent({ ...next, winner: "bot" }, "bot captured the enemy capital.");
  if (next.territories[capitalId(next, "bot")].owner === "human") return withEvent({ ...next, winner: "human" }, "human captured the enemy capital.");
  if (next.tick >= next.maxTicks) {
    const humanScore = controlScore(next, "human"); const botScore = controlScore(next, "bot");
    const winner = humanScore === botScore ? "draw" : humanScore > botScore ? "human" : "bot";
    return withEvent({ ...next, winner }, winner === "draw" ? "Time expired. The match is a draw." : `Time expired. ${winner} controls the frontier.`);
  }
  return next;
}

export function getControlScore(state: GameState, player: PlayerId): number { return controlScore(state, player); }
