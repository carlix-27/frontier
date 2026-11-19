import { getTerritory, linkId } from "../engine/map";
import { buildingCost, defenceOf } from "../engine/game";
import { isPlayerAlive } from "../engine/players";
import { areAllied } from "../engine/diplomacy";
import { getSkill, POPULATION_SKILLS, populationEffects, researchPath, skillLockReason, type SkillBranch, type SkillId } from "../engine/population";
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
    return state.territories[from].units - 1 + roadBonus + populationEffects(state.territories[from]).attack > defenceOf(state, to) + attackMargin;
  }).sort((left, right) => {
    const priority = (to: TerritoryId) => { const territory = getTerritory(state.map, to); return territory.capitalFor && territory.capitalFor !== player ? 3 : state.territories[to].owner ? 2 : territory.island ? 1 : 0; };
    return priority(right.to) - priority(left.to) || defenceOf(state, left.to) - defenceOf(state, right.to);
  })[0];
  // Research costs no troops, so on research turns it comes first unless an enemy capital can fall right now.
  const researchTurn = state.tick % (difficulty === "easy" ? 12 : 6) === 0;
  const capitalStrike = winningAttack && !!getTerritory(state.map, winningAttack.to).capitalFor;
  if (researchTurn && !capitalStrike) {
    const research = chooseResearch(state, player, owned, difficulty, false);
    if (research) return research;
  }
  if (winningAttack) {
    const source = state.territories[winningAttack.from];
    const needed = defenceOf(state, winningAttack.to) + attackMargin + 1;
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
  if (researchTurn) {
    const plan = chooseResearch(state, player, owned, difficulty, true);
    if (plan) return plan;
  }
  const trade = owned.flatMap((from) => owned.filter((to) => to !== from).map((to) => ({ from, to }))).find(({ from, to }) => !state.tradeRoutes.some((route) => route.player === player && route.recipient === player && route.id === linkId(from, to)));
  if (trade && state.tradeRoutes.filter((route) => route.player === player).length < Math.max(1, Math.floor(owned.length / 6))) return { type: "trade", player, from: trade.from, to: trade.to };
  const buildOrder: BuildingType[] = ["factory", "railway", "housing"];
  const construction = owned.flatMap((territory) => buildOrder.filter((building) => state.tradeCredits[player] >= buildingCost(state.territories[territory], building) && !state.territories[territory].buildings.includes(building)).map((building) => ({ territory, building })))[0];
  if (construction) return { type: "build", player, territory: construction.territory, building: construction.building };
  const threatened = owned.find((id) => state.territories[id].fortification < 1 && state.territories[id].units >= 8 && getTerritory(state.map, id).neighbours.some((neighbour) => state.territories[neighbour].owner !== null && state.territories[neighbour].owner !== player));
  if (threatened) return { type: "fortify", player, territory: threatened };
  const supply = options.find(({ from, to, target }) => getTerritory(state.map, from).neighbours.includes(to) && target.owner === player && state.territories[from].units >= supplyThreshold && !state.suppliedLinks.includes(linkId(from, to)));
  return supply ? { type: "supply", player, from: supply.from, to: supply.to } : null;
}

export type ProvinceRole = "capital" | "front" | "interior";
/** Capitals grow, frontier provinces defend, safe interior provinces produce. */
export function provinceRole(state: GameState, player: PlayerId, territoryId: TerritoryId): ProvinceRole {
  const definition = getTerritory(state.map, territoryId);
  if (definition.capitalFor === player) return "capital";
  const hostile = [...definition.neighbours, ...definition.seaNeighbours].some((id) => {
    const owner = state.territories[id].owner;
    return !!owner && owner !== player && !areAllied(state, player, owner);
  });
  return hostile ? "front" : "interior";
}
const ROLE_BRANCHES: Record<ProvinceRole, SkillBranch[]> = {
  capital: ["civil", "economy", "politics", "defence"],
  front: ["defence", "economy", "civil", "politics"],
  interior: ["economy", "politics", "civil", "defence"],
};
/** Long-term specialisation per role: expert first, normal second. */
const ROLE_GOALS: Record<ProvinceRole, [SkillId, SkillId]> = {
  capital: ["university", "metropolis"],
  front: ["bastion", "expedition"],
  interior: ["industrial-hub", "freeport"],
};

function chooseResearch(state: GameState, player: PlayerId, owned: TerritoryId[], difficulty: BotDifficulty, allowPlan: boolean): GameCommand | null {
  const credits = state.tradeCredits[player];
  let best: { territory: TerritoryId; skill: SkillId; score: number } | null = null;
  for (const territory of owned) {
    const role = provinceRole(state, player, territory);
    const goal = difficulty === "easy" ? null : ROLE_GOALS[role][difficulty === "expert" ? 0 : 1];
    const plan = goal ? researchPath(state.territories[territory], goal) : null;
    for (const skill of POPULATION_SKILLS) {
      if (skillLockReason(state.territories[territory], skill, credits)) continue;
      const branchRank = ROLE_BRANCHES[role].indexOf(skill.branch);
      let score = skill.tier * 2 + (3 - branchRank) * 1.5 + (role === "capital" ? 1 : 0);
      if (plan && !plan.problem && plan.path.includes(skill.id)) score += 4;
      if (goal && getSkill(goal)!.excludes === skill.id) score -= 10;
      if (!best || score > best.score) best = { territory, skill: skill.id, score };
    }
  }
  if (best) return { type: "research", player, territory: best.territory, skill: best.skill };
  if (difficulty === "easy" || !allowPlan) return null;
  // Nothing is affordable now: set a plan so the province keeps progressing on its own.
  for (const territory of owned) {
    const province = state.territories[territory];
    if (province.researchGoal) continue;
    const goal = ROLE_GOALS[provinceRole(state, player, territory)][difficulty === "expert" ? 0 : 1];
    if (!province.skills?.includes(goal) && !researchPath(province, goal).problem) return { type: "planResearch", player, territory, skill: goal };
  }
  return null;
}
