import type { GameState, PlayerId } from "./types";

export function allianceId(first: PlayerId, second: PlayerId): string {
  return [first, second].sort().join(":");
}

export function areAllied(state: GameState, first: PlayerId, second: PlayerId): boolean {
  return first !== second && state.alliances.includes(allianceId(first, second));
}
