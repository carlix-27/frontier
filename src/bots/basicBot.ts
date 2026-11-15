import { getTerritory, linkId } from "../engine/map";
import { BUILDING_COSTS } from "../engine/game";
import type { BuildingType, GameCommand, GameState, PlayerId } from "../engine/types";

export type BotDifficulty = "easy" | "normal" | "expert";

export function chooseBotCommand(state: GameState, difficulty: BotDifficulty, player: PlayerId = "bot"): GameCommand | null {
  const owned = Object.entries(state.territories).filter(([, territory]) => territory.owner === player).map(([id]) => id);
  const attackMargin = difficulty === "easy" ? 5 : difficulty === "normal" ? 3 : 1;
  const supplyThreshold = difficulty === "easy" ? 10 : difficulty === "normal" ? 7 : 5;
  const options = owned.flatMap((from) => getTerritory(state.map, from).neighbours.map((to) => ({ from, to, target: state.territories[to] })));
  const buildOrder: BuildingType[] = ["factory", "railway", "housing"];
  const construction = owned.flatMap((territory) => buildOrder.filter((building) => state.tradeCredits[player] >= BUILDING_COSTS[building] && !state.territories[territory].buildings.includes(building)).map((building) => ({ territory, building })))[0];
  if (construction) return { type: "build", player, territory: construction.territory, building: construction.building };
  const trade = owned.flatMap((from) => owned.filter((to) => to !== from).map((to) => ({ from, to }))).find(({ from, to }) => !state.tradeRoutes.some((route) => route.player === player && route.id === linkId(from, to)));
  if (trade) return { type: "trade", player, from: trade.from, to: trade.to };
  const winningAttack = options.filter(({ from, target }) => target.owner !== player && state.territories[from].units >= target.units + target.fortification * 2 + attackMargin).sort((left, right) => Number(right.target.owner !== null && right.target.owner !== player) - Number(left.target.owner !== null && left.target.owner !== player))[0];
  if (winningAttack) return { type: "expand", player, from: winningAttack.from, to: winningAttack.to };
  const threatened = owned.find((id) => state.territories[id].fortification < 2 && state.territories[id].units >= 3 && getTerritory(state.map, id).neighbours.some((neighbour) => state.territories[neighbour].owner !== null && state.territories[neighbour].owner !== player));
  if (threatened) return { type: "fortify", player, territory: threatened };
  const supply = options.find(({ from, to, target }) => target.owner === player && state.territories[from].units >= supplyThreshold && !state.suppliedLinks.includes(linkId(from, to)));
  return supply ? { type: "supply", player, from: supply.from, to: supply.to } : null;
}
