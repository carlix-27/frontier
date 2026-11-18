import type { GameState, PlayerId } from "./types";

export function allianceId(first: PlayerId, second: PlayerId): string {
  return [first, second].sort().join(":");
}

export function areAllied(state: GameState, first: PlayerId, second: PlayerId): boolean {
  return first !== second && state.alliances.includes(allianceId(first, second));
}

/** A bot values a strong partner and refuses a vastly weaker one. */
export function evaluateAlliance(state: GameState, proposer: PlayerId, bot: PlayerId): { accepted: boolean; reason: string } {
  const strength = (player: PlayerId) => Object.values(state.territories).reduce((sum, territory) => sum + (territory.owner === player ? 1 + territory.units : 0), 0);
  if (strength(bot) >= strength(proposer) * 3) return { accepted: false, reason: "Our nation is much stronger; we prefer to remain independent." };
  return { accepted: true, reason: "Cooperation will strengthen both nations." };
}
