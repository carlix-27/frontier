import { areAllied } from "./diplomacy";
import { isPlayerAlive } from "./players";
import type { BattleReport, GameState, PlayerId, TerritoryId } from "./types";

export const BATTLE_REPORT_TICKS = 8;

export function recordBattle(state: GameState, territory: TerritoryId, attacker: PlayerId, defender: PlayerId | null, captured: boolean): GameState {
  if (!defender || defender === attacker) return state;
  const report: BattleReport = { territory, attacker, defender, tick: state.tick, outcome: captured ? "captured" : "repelled" };
  const others = (state.recentBattles ?? []).filter(b => b.territory !== territory || b.attacker !== attacker || b.defender !== defender);
  return { ...state, recentBattles: [report, ...others] };
}

export function playerBattles(state: GameState, player: PlayerId): BattleReport[] {
  if (state.winner) return [];
  const approaching: BattleReport[] = [];
  for (const ship of state.invasions) {
    const defender = state.territories[ship.to].owner;
    if (!defender || defender === ship.player || (defender !== player && ship.player !== player)) continue;
    if (!isPlayerAlive(state, ship.player) || areAllied(state, defender, ship.player)) continue;
    if (!approaching.some(b => b.territory === ship.to && b.attacker === ship.player)) {
      approaching.push({ territory: ship.to, attacker: ship.player, defender, tick: state.tick, outcome: "approaching" });
    }
  }
  const recent = (state.recentBattles ?? []).filter(b => b.attacker === player || b.defender === player);
  return [...approaching, ...recent];
}
