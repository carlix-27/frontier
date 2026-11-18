import type { GameState, PlayerId } from "./types";

export function allianceId(first: PlayerId, second: PlayerId): string {
  return [first, second].sort().join(":");
}

export function areAllied(state: GameState, first: PlayerId, second: PlayerId): boolean {
  return first !== second && state.alliances.includes(allianceId(first, second));
}

/** Seeded per proposal, so the same game state remains reproducible. */
export function allianceRoll(seed: number, proposer: PlayerId, bot: PlayerId, attempt: number): number {
  let hash = (seed ^ 2166136261) >>> 0;
  for (const char of `${proposer}:${bot}:${attempt}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d); hash ^= hash >>> 15; hash = Math.imul(hash, 0x846ca68b); hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}
export function evaluateAlliance(state: GameState, proposer: PlayerId, bot: PlayerId, roll: number): { accepted: boolean; reason: string } {
  const strength = (player: PlayerId) => Object.values(state.territories).reduce((sum, territory) => sum + (territory.owner === player ? 1 + territory.units : 0), 0);
  const ratio = strength(proposer) / Math.max(1, strength(bot));
  const chance = Math.max(.2, Math.min(.8, .5 + (ratio - 1) * .2));
  return roll < chance ? { accepted: true, reason: "Cooperation will strengthen both nations." } : { accepted: false, reason: ratio < .6 ? "Your forces are too weak for our interests." : "Our nation prefers to remain independent for now." };
}
