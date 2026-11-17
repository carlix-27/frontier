import type { GameState, PlayerId } from "./types";

export const MAX_BOTS = 8;

export const PLAYER_PALETTE = [
  { name: "Blue", color: "#83c5df" },
  { name: "Red", color: "#e6a0a0" },
  { name: "Yellow", color: "#ead37e" },
  { name: "Violet", color: "#c2abe7" },
  { name: "Gray", color: "#aebbc7" },
  { name: "White", color: "#e8e8df" },
  { name: "Orange", color: "#edba91" },
  { name: "Teal", color: "#8bd2c5" },
  { name: "Pink", color: "#edb3cf" },
] as const;

export function getBotIds(count: number): PlayerId[] {
  return Array.from({ length: Math.max(1, Math.min(MAX_BOTS, Math.floor(Number.isFinite(count) ? count : 1))) }, (_, index) => index === 0 ? "bot" : `bot-${index + 1}` as PlayerId);
}

export function getMatchPlayers(state: GameState): PlayerId[] {
  const present = new Set(state.map.territories.flatMap((territory) => territory.capitalFor ? [territory.capitalFor] : []));
  return (["human", ...getBotIds(MAX_BOTS)] as PlayerId[]).filter((player) => present.has(player));
}

export function isPlayerAlive(state: GameState, player: PlayerId): boolean {
  const capital = state.map.territories.find((territory) => territory.capitalFor === player);
  return !!capital && state.territories[capital.id].owner === player;
}

export function getPlayerName(player: PlayerId): string {
  if (player === "human") return "Blue";
  const index = player === "bot" ? 1 : Number(player.slice(4));
  return PLAYER_PALETTE[index]?.name ?? `Bot ${index}`;
}

export function getPlayerColor(player: PlayerId | null): string {
  if (!player) return "#a4be90";
  const index = player === "human" ? 0 : player === "bot" ? 1 : Number(player.slice(4));
  return PLAYER_PALETTE[index]?.color ?? "#a4be90";
}
