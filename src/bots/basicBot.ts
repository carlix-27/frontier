import { getTerritory, linkId } from "../engine/map";
import { BUILDING_COSTS } from "../engine/game";
import { isPlayerAlive } from "../engine/players";
import { areAllied } from "../engine/diplomacy";
import type { BuildingType, GameCommand, GameState, PlayerId, TerritoryId } from "../engine/types";

export type BotDifficulty = "easy" | "normal" | "expert";

export function chooseBotCommand(state: GameState, difficulty: BotDifficulty, player: PlayerId = "bot"): GameCommand | null {
  if (!isPlayerAlive(state, player)) return null;
  const owned = Object.entries(state.territories).filter(([, territory]) => territory.owner === player).map(([id]) => id);
  const attackMargin = difficulty === "easy" ? 3 : difficulty === "normal" ? 1 : 0;
  const supplyThreshold = difficulty === "easy" ? 10 : difficulty === "normal" ? 7 : 5;
  const options = owned.flatMap((from) => { const territory = getTerritory(state.map, from); return [...territory.neighbours, ...territory.seaNeighbours].map((to) => ({ from, to, target: state.territories[to] })); });
  const winningAttack = options.filter(({ from, to, target }) => {
    if (target.owner === player || (target.owner && areAllied(state, player, target.owner))) return false;
    const origin = getTerritory(state.map, from);
    const roadBonus = !origin.seaNeighbours.includes(to) && origin.neighbours.some((neighbor) => state.territories[neighbor].owner === player) ? 1 : 0;
    return state.territories[from].units - 1 + roadBonus > target.units + target.fortification * 2 + attackMargin;
  }).sort((left, right) => {
    const priority = (to: TerritoryId) => { const territory = getTerritory(state.map, to); return territory.capitalFor && territory.capitalFor !== player ? 3 : state.territories[to].owner ? 2 : territory.island ? 1 : 0; };
    return priority(right.to) - priority(left.to) || (left.target.units + left.target.fortification * 2) - (right.target.units + right.target.fortification * 2);
  })[0];
  if (winningAttack) {
    const source = state.territories[winningAttack.from];
    const needed = winningAttack.target.units + winningAttack.target.fortification * 2 + attackMargin + 1;
    return { type: "expand", player, from: winningAttack.from, to: winningAttack.to, units: Math.min(source.units - 1, Math.max(Math.ceil(source.units * .75), needed)) };
  }
  const distance = new Map<TerritoryId, number>();
  const queue = owned.filter((id) => { const territory = getTerritory(state.map, id); return [...territory.neighbours, ...territory.seaNeighbours].some((neighbor) => state.territories[neighbor].owner !== player); });
  for (const id of queue) distance.set(id, 0);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const neighbor of getTerritory(state.map, current).neighbours) {
      if (state.territories[neighbor].owner !== player || distance.has(neighbor)) continue;
      distance.set(neighbor, distance.get(current)! + 1); queue.push(neighbor);
    }
  }
  const transfer = owned.filter((id) => (distance.get(id) ?? 0) > 0 && state.territories[id].units >= 8).sort((first, second) => state.territories[second].units - state.territories[first].units).map((from) => ({ from, to: getTerritory(state.map, from).neighbours.find((neighbor) => state.territories[neighbor].owner === player && (distance.get(neighbor) ?? Infinity) < (distance.get(from) ?? Infinity)) })).find(({ to }) => !!to);
  if (transfer?.to) return { type: "expand", player, from: transfer.from, to: transfer.to, units: Math.floor(state.territories[transfer.from].units / 2) };
  const trade = owned.flatMap((from) => owned.filter((to) => to !== from).map((to) => ({ from, to }))).find(({ from, to }) => !state.tradeRoutes.some((route) => route.player === player && route.recipient === player && route.id === linkId(from, to)));
  if (trade && state.tradeRoutes.filter((route) => route.player === player).length < Math.max(1, Math.floor(owned.length / 6))) return { type: "trade", player, from: trade.from, to: trade.to };
  const buildOrder: BuildingType[] = ["factory", "railway", "housing"];
  const construction = owned.flatMap((territory) => buildOrder.filter((building) => state.tradeCredits[player] >= BUILDING_COSTS[building] && !state.territories[territory].buildings.includes(building)).map((building) => ({ territory, building })))[0];
  if (construction) return { type: "build", player, territory: construction.territory, building: construction.building };
  const threatened = owned.find((id) => state.territories[id].fortification < 1 && state.territories[id].units >= 8 && getTerritory(state.map, id).neighbours.some((neighbour) => state.territories[neighbour].owner !== null && state.territories[neighbour].owner !== player));
  if (threatened) return { type: "fortify", player, territory: threatened };
  const supply = options.find(({ from, to, target }) => getTerritory(state.map, from).neighbours.includes(to) && target.owner === player && state.territories[from].units >= supplyThreshold && !state.suppliedLinks.includes(linkId(from, to)));
  return supply ? { type: "supply", player, from: supply.from, to: supply.to } : null;
}
