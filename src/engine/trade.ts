import { areAllied } from "./diplomacy";
import { isCoastal } from "./navigation";
import { isPlayerAlive } from "./players";
import type { GameState, PlayerId, TradeRoute } from "./types";

export function tradeProblem(state: GameState, player: PlayerId, from: string, to: string): string | null {
  const source = state.territories[from], target = state.territories[to];
  if (!source || source.owner !== player || !target?.owner) return "Choose your coastal province and a foreign coastal destination.";
  if (target.owner === player) return "Trade is only available with another nation.";
  if (!isPlayerAlive(state, player) || !isPlayerAlive(state, target.owner)) return "Trade requires two active nations.";
  if (!areAllied(state, player, target.owner)) return "Establish an alliance with that nation before trading.";
  if (!isCoastal(state.map, from) || !isCoastal(state.map, to)) return "Trading ships need coastal provinces at both ends.";
  return null;
}

export function activeTradeRoute(state: GameState, route: TradeRoute): boolean {
  return state.territories[route.to]?.owner === route.recipient && !tradeProblem(state, route.player, route.from, route.to);
}
