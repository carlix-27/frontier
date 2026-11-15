import { getTerritory, linkId } from "../engine/map";
import type { GameCommand, GameState } from "../engine/types";

export type BotDifficulty = "easy" | "normal" | "expert";

export function chooseBotCommand(state: GameState, difficulty: BotDifficulty): GameCommand | null {
  const owned = Object.entries(state.territories).filter(([, territory]) => territory.owner === "bot").map(([id]) => id);
  const attackMargin = difficulty === "easy" ? 5 : difficulty === "normal" ? 3 : 1;
  const supplyThreshold = difficulty === "easy" ? 10 : difficulty === "normal" ? 7 : 5;
  const options = owned.flatMap((from) => getTerritory(state.map, from).neighbours.map((to) => ({ from, to, target: state.territories[to] })));
  const winningAttack = options.filter(({ from, target }) => target.owner !== "bot" && state.territories[from].units >= target.units + target.fortification * 2 + attackMargin).sort((left, right) => Number(right.target.owner === "human") - Number(left.target.owner === "human"))[0];
  if (winningAttack) return { type: "expand", player: "bot", from: winningAttack.from, to: winningAttack.to };
  const threatened = owned.find((id) => state.territories[id].fortification < 2 && state.territories[id].units >= 3 && getTerritory(state.map, id).neighbours.some((neighbour) => state.territories[neighbour].owner === "human"));
  if (threatened) return { type: "fortify", player: "bot", territory: threatened };
  const supply = options.find(({ from, to, target }) => target.owner === "bot" && state.territories[from].units >= supplyThreshold && !state.suppliedLinks.includes(linkId(from, to)));
  return supply ? { type: "supply", player: "bot", from: supply.from, to: supply.to } : null;
}
