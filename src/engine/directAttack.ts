import type { ExpandCommand, GameState, PlayerId, TerritoryId } from "./types";

/** Choose the strongest connected garrison, reserving at least one defender. */
export function directAttack(state: GameState, player: PlayerId, target: TerritoryId, percent: number): ExpandCommand | null {
  const origins = state.map.territories.filter(province => {
    const garrison = state.territories[province.id];
    return garrison.owner === player && garrison.units >= 2 &&
      (province.neighbours.includes(target) || province.seaNeighbours.includes(target));
  });
  origins.sort((a, b) => state.territories[b.id].units - state.territories[a.id].units);
  const origin = origins[0];
  if (!origin) return null;
  const available = state.territories[origin.id].units;
  const ratio = Number.isFinite(percent) ? Math.max(1, Math.min(100, percent)) / 100 : .25;
  const units = Math.max(1, Math.min(available - 1, Math.floor(available * ratio)));
  return { type: "expand", player, from: origin.id, to: target, units };
}
