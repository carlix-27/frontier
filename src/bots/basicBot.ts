import { territoriesById } from "../engine/map";
import type { GameCommand, GameState, TerritoryId } from "../engine/types";

export type BotDifficulty = "easy" | "normal" | "expert";

function territoryIds(state: GameState, owner: "human" | "bot"): TerritoryId[] {
  return Object.entries(state.territories)
    .filter(([, territory]) => territory.owner === owner)
    .map(([id]) => id);
}

export function chooseBotCommand(state: GameState, difficulty: BotDifficulty): GameCommand | null {
  const owned = territoryIds(state, "bot");
  const attackMargin = difficulty === "easy" ? 5 : difficulty === "normal" ? 3 : 1;
  const fortifyThreshold = difficulty === "easy" ? 10 : difficulty === "normal" ? 7 : 5;

  const options = owned.flatMap((from) =>
    territoriesById[from].neighbours.map((to) => ({ from, to, target: state.territories[to] })),
  );

  const winningAttack = options
    .filter(({ from, target }) => target.owner !== "bot" && state.territories[from].units >= target.units + target.fortification * 2 + attackMargin)
    .sort((left, right) => (left.target.owner === "human" ? -1 : 1) - (right.target.owner === "human" ? -1 : 1))[0];
  if (winningAttack) return { type: "expand", player: "bot", from: winningAttack.from, to: winningAttack.to };

  const threatened = owned.find((id) => {
    const territory = state.territories[id];
    return territory.fortification < 2 && territory.units >= 3 && territoriesById[id].neighbours.some(
      (neighbour) => state.territories[neighbour].owner === "human",
    );
  });
  if (threatened) return { type: "fortify", player: "bot", territory: threatened };

  const supply = options.find(({ from, to, target }) =>
    target.owner === "bot" && state.territories[from].units >= fortifyThreshold && !state.suppliedLinks.includes([from, to].sort().join(":")),
  );
  if (supply) return { type: "supply", player: "bot", from: supply.from, to: supply.to };
  return null;
}
