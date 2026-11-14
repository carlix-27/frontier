import { linkId, territoryDefinitions, territoriesById } from "./map";
import type { CommandResult, GameCommand, GameState, PlayerId, TerritoryId, TerritoryState } from "./types";

const PRODUCTION_INTERVAL = 3;
const MAX_FORTIFICATION = 3;
const EVENT_LIMIT = 8;

function copyTerritories(territories: GameState["territories"]): GameState["territories"] {
  return Object.fromEntries(
    Object.entries(territories).map(([id, territory]) => [id, { ...territory }]),
  ) as Record<TerritoryId, TerritoryState>;
}

function withEvent(state: GameState, message: string): GameState {
  const event = { tick: state.tick, message };
  return { ...state, events: [event, ...state.events].slice(0, EVENT_LIMIT) };
}

function opponent(player: PlayerId): PlayerId {
  return player === "human" ? "bot" : "human";
}

function isConnectedToCapital(state: GameState, territoryId: TerritoryId, player: PlayerId): boolean {
  const capital = territoryDefinitions.find(
    (territory) => territory.capital && state.territories[territory.id].owner === player,
  );
  if (!capital) return false;

  const visited = new Set<TerritoryId>([capital.id]);
  const queue = [capital.id];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current === territoryId) return true;
    for (const neighbour of territoriesById[current].neighbours) {
      if (!visited.has(neighbour) && state.territories[neighbour].owner === player) {
        visited.add(neighbour);
        queue.push(neighbour);
      }
    }
  }
  return false;
}

function hasNeighbour(from: TerritoryId, to: TerritoryId): boolean {
  return territoriesById[from]?.neighbours.includes(to) ?? false;
}

function winnerFromCapitals(state: GameState): PlayerId | null {
  const humanCapital = state.territories.harbor;
  const botCapital = state.territories.citadel;
  if (humanCapital.owner === "bot") return "bot";
  if (botCapital.owner === "human") return "human";
  return null;
}

function controlScore(state: GameState, player: PlayerId): number {
  return Object.values(state.territories).reduce(
    (total, territory) => total + (territory.owner === player ? 1 + territory.fortification : 0),
    0,
  );
}

export function createInitialGame(maxTicks = 300): GameState {
  const territories = Object.fromEntries(
    territoryDefinitions.map((territory) => [
      territory.id,
      {
        owner: territory.id === "harbor" ? "human" : territory.id === "citadel" ? "bot" : null,
        units: territory.capital ? 12 : 2,
        fortification: territory.capital ? 1 : 0,
      },
    ]),
  ) as Record<TerritoryId, TerritoryState>;

  return {
    tick: 0,
    maxTicks,
    territories,
    suppliedLinks: [],
    events: [{ tick: 0, message: "Secure your capital, then claim the frontier." }],
    winner: null,
  };
}

export function applyCommand(state: GameState, command: GameCommand): CommandResult {
  if (state.winner) return { ok: false, state, reason: "The match is already over." };
  const territories = copyTerritories(state.territories);

  if (command.type === "fortify") {
    const territory = territories[command.territory];
    if (!territory || territory.owner !== command.player) return { ok: false, state, reason: "Choose one of your territories." };
    if (territory.units < 3) return { ok: false, state, reason: "Fortify requires 3 units." };
    if (territory.fortification >= MAX_FORTIFICATION) return { ok: false, state, reason: "That territory is fully fortified." };
    territory.units -= 2;
    territory.fortification += 1;
    return { ok: true, state: withEvent({ ...state, territories }, `${command.player} fortified ${territoriesById[command.territory].label}.`) };
  }

  if (!hasNeighbour(command.from, command.to)) return { ok: false, state, reason: "Those territories are not connected." };
  const source = territories[command.from];
  const target = territories[command.to];
  if (source.owner !== command.player) return { ok: false, state, reason: "Choose one of your territories first." };

  if (command.type === "supply") {
    if (target.owner !== command.player) return { ok: false, state, reason: "Supply routes connect two friendly territories." };
    const route = linkId(command.from, command.to);
    if (state.suppliedLinks.includes(route)) return { ok: false, state, reason: "That supply route is already active." };
    if (source.units < 4) return { ok: false, state, reason: "Supply routes require 4 units." };
    source.units -= 3;
    target.units += 1;
    return {
      ok: true,
      state: withEvent(
        { ...state, territories, suppliedLinks: [...state.suppliedLinks, route] },
        `${command.player} opened a supply route to ${territoriesById[command.to].label}.`,
      ),
    };
  }

  if (source.units < 3) return { ok: false, state, reason: "Expansion requires at least 3 units." };
  const attackers = Math.floor(source.units / 2);
  source.units -= attackers;
  const defence = target.units + target.fortification * 2;
  if (attackers > defence) {
    const previousOwner = target.owner;
    target.owner = command.player;
    target.units = attackers - defence;
    target.fortification = 0;
    const label = territoriesById[command.to].label;
    const message = previousOwner ? `${command.player} captured ${label}.` : `${command.player} claimed ${label}.`;
    return { ok: true, state: withEvent({ ...state, territories }, message) };
  }

  target.units = Math.max(1, defence - attackers);
  return {
    ok: true,
    state: withEvent({ ...state, territories }, `${command.player}'s attack on ${territoriesById[command.to].label} was repelled.`),
  };
}

export function advanceGame(state: GameState): GameState {
  if (state.winner) return state;
  let next: GameState = { ...state, tick: state.tick + 1, territories: copyTerritories(state.territories) };

  if (next.tick % PRODUCTION_INTERVAL === 0) {
    for (const definition of territoryDefinitions) {
      const territory = next.territories[definition.id];
      if (territory.owner && isConnectedToCapital(next, definition.id, territory.owner)) {
        const supplyBonus = definition.neighbours.some((neighbour) =>
          next.suppliedLinks.includes(linkId(definition.id, neighbour)),
        ) ? 1 : 0;
        territory.units += 1 + supplyBonus;
      }
    }
  }

  const capitalWinner = winnerFromCapitals(next);
  if (capitalWinner) return withEvent({ ...next, winner: capitalWinner }, `${capitalWinner} captured the enemy capital.`);
  if (next.tick >= next.maxTicks) {
    const humanScore = controlScore(next, "human");
    const botScore = controlScore(next, "bot");
    const winner = humanScore === botScore ? "draw" : humanScore > botScore ? "human" : "bot";
    return withEvent({ ...next, winner }, `Time expired. ${winner === "draw" ? "The match is a draw." : `${winner} controls the frontier.`}`);
  }
  return next;
}

export function getControlScore(state: GameState, player: PlayerId): number {
  return controlScore(state, player);
}

export function getOpponent(player: PlayerId): PlayerId {
  return opponent(player);
}
