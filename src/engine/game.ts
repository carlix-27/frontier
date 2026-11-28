import { CUSTOM_MAP_ID, generateFrontierMap, getTerritory, linkId, MAP_PRESETS } from "./map";
import { allianceId, allianceRoll, areAllied, evaluateAlliance } from "./diplomacy";
import { BATTLE_REPORT_TICKS, recordBattle } from "./battles";
import { canSail } from "./navigation";
import { activeTradeRoute, tradeProblem } from "./trade";
import { getMatchPlayers, getPlayerName, isPlayerAlive } from "./players";
import { CYCLE_SECONDS, developmentRate, getSkill, populationEffects, researchPath, skillLockReason } from "./population";
import { terrainEffects } from "./terrain";
import type { MapGenerationConfig } from "./types";
import type { SkillId } from "./population";
import type { BuildingType, CommandResult, GameCommand, GameState, PlayerId, PopulationUpgrade, TerritoryId, TerritoryState } from "./types";

const PRODUCTION_INTERVAL = CYCLE_SECONDS;
const MAX_FORTIFICATION = 3;
const EVENT_LIMIT = 8;
export const BUILDING_COSTS: Record<BuildingType, number> = { housing: 4, factory: 7, railway: 5 };
export const BUILDING_NAMES: Record<BuildingType, string> = { housing: "Housing district", factory: "Factory", railway: "Railway" };
export function buildingCost(territory: TerritoryState, building: BuildingType): number { return Math.max(1, BUILDING_COSTS[building] - populationEffects(territory).discount); }
export const UPGRADE_NAMES: Record<PopulationUpgrade, string> = { housing: "Neighborhoods", industry: "Workshops", militia: "Civil guard" };
export function upgradeCost(level: number): number { return 3 + level * 3; }

function copyTerritories(territories: GameState["territories"]): GameState["territories"] {
  return Object.fromEntries(Object.entries(territories).map(([id, territory]) => [id, { ...territory }])) as Record<TerritoryId, TerritoryState>;
}

function withEvent(state: GameState, message: string, movement?: GameState["events"][number]["movement"], capture?: GameState["events"][number]["capture"]): GameState {
  return { ...state, events: [{ tick: state.tick, message, movement, capture }, ...state.events].slice(0, EVENT_LIMIT) };
}

function withRoad(state: GameState, from: TerritoryId, to: TerritoryId): GameState {
  const road = linkId(from, to);
  return state.roadLinks.includes(road) ? state : { ...state, roadLinks: [...state.roadLinks, road] };
}

function capitalId(state: GameState, player: PlayerId): TerritoryId {
  const capital = state.map.territories.find((territory) => territory.capitalFor === player);
  if (!capital) throw new Error(`Missing ${player} capital.`);
  return capital.id;
}

function isConnectedToCapital(state: GameState, territoryId: TerritoryId, player: PlayerId): boolean {
  if (!isPlayerAlive(state, player)) return false;
  const capital = capitalId(state, player);
  const visited = new Set<TerritoryId>([capital]);
  const queue = [capital];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current === territoryId) return true;
    const definition = getTerritory(state.map, current);
    const sailing = state.map.territories.filter(province => state.territories[province.id].owner === player && canSail(state.map, definition, province)).map(province => province.id);
    for (const neighbour of [...definition.neighbours, ...definition.seaNeighbours, ...sailing]) {
      if (!visited.has(neighbour) && state.territories[neighbour].owner === player) { visited.add(neighbour); queue.push(neighbour); }
    }
  }
  return false;
}

/** Total defence of a province: garrison, fortifications, local skills and terrain. */
export function defenceOf(state: GameState, territoryId: TerritoryId, territory: TerritoryState = state.territories[territoryId]): number {
  return territory.units + territory.fortification * 2 + populationEffects(territory).defence + terrainEffects(getTerritory(state.map, territoryId).terrain).defence;
}

/** Learns a validated skill. `state.territories` must already be a copy. */
function learnSkill(state: GameState, territoryId: TerritoryId, player: PlayerId, skillId: SkillId, planned = false): GameState {
  const skill = getSkill(skillId)!;
  const territory = state.territories[territoryId];
  territory.skills = [...(territory.skills ?? []), skill.id];
  territory.development = (territory.development ?? 0) - skill.points;
  const label = getTerritory(state.map, territoryId).label;
  return withEvent({ ...state, tradeCredits: { ...state.tradeCredits, [player]: state.tradeCredits[player] - skill.credits } }, planned ? `${label} completed planned research: ${skill.name}.` : `${label} adopted ${skill.name}.`);
}

/** Takes the next affordable step towards a province's research goal. */
function progressResearchGoal(state: GameState, territoryId: TerritoryId): GameState {
  const territory = state.territories[territoryId];
  const goal = territory.researchGoal;
  if (!goal || !territory.owner) return state;
  const { path, problem } = researchPath(territory, goal);
  if (problem || path.length === 0) {
    delete territory.researchGoal;
    return problem ? withEvent(state, `${getTerritory(state.map, territoryId).label} dropped its research plan: ${problem}.`) : state;
  }
  const step = getSkill(path[0])!;
  if (skillLockReason(territory, step, state.tradeCredits[territory.owner])) return state;
  const next = learnSkill(state, territoryId, territory.owner, step.id, true);
  if (path.length === 1) delete next.territories[territoryId].researchGoal;
  return next;
}

function progressGoalAfterManualLearn(state: GameState, territoryId: TerritoryId): GameState {
  const territory = state.territories[territoryId];
  if (territory.researchGoal && territory.skills?.includes(territory.researchGoal)) delete territory.researchGoal;
  return state;
}

function controlScore(state: GameState, player: PlayerId): number {
  return Object.values(state.territories).reduce((total, territory) => total + (territory.owner === player ? 1 + territory.fortification : 0), 0);
}

export function getPopulation(state: GameState, player: PlayerId): number {
  return Object.values(state.territories).reduce((total, territory) => total + (territory.owner === player ? territory.population : 0), 0);
}

export function createInitialGame(maxTicks = 300, seed = 27, presetId = "crownlands", botCount = 1, generation?: MapGenerationConfig): GameState {
  const map = generateFrontierMap(seed, presetId, botCount, generation);
  const territories = Object.fromEntries(map.territories.map((territory) => [territory.id, { owner: territory.capitalFor ?? null, units: territory.capitalFor ? 12 : 2, population: territory.capitalFor ? 220 : 40, fortification: territory.capitalFor ? 1 : 0, buildings: territory.capitalFor ? ["housing"] : [], upgrades: {} }])) as Record<TerritoryId, TerritoryState>;
  const tradeCredits = Object.fromEntries(map.territories.filter((territory) => territory.capitalFor).map((territory) => [territory.capitalFor, 0])) as Record<PlayerId, number>;
  return { tick: 0, maxTicks, map, territories, roadLinks: [], suppliedLinks: [], alliances: [], tradeRoutes: [], invasions: [], tradeCredits, events: [{ tick: 0, message: "Secure your capital, then claim the frontier." }], winner: null };
}

export function createRematch(state: GameState): GameState {
  const bots = getMatchPlayers(state).length - 1;
  if (state.map.id.startsWith(`${CUSTOM_MAP_ID}-`)) return createInitialGame(state.maxTicks, state.map.seed, CUSTOM_MAP_ID, bots, state.map.generation);
  const preset = MAP_PRESETS.find((candidate) => state.map.id.startsWith(`${candidate.id}-`)) ?? MAP_PRESETS[0];
  return createInitialGame(state.maxTicks, state.map.seed, preset.id, bots);
}

export function applyCommand(state: GameState, command: GameCommand): CommandResult {
  if (state.winner) return { ok: false, state, reason: "The match is already over." };
  if (!isPlayerAlive(state, command.player)) return { ok: false, state, reason: "Your capital has fallen. You can spectate the remaining players." };
  if (command.type === "ally" || command.type === "endAlliance") {
    if (command.with === command.player || !isPlayerAlive(state, command.with)) return { ok: false, state, reason: "Choose an active nation to negotiate with." };
    const id = allianceId(command.player, command.with);
    const allied = state.alliances.includes(id);
    if (command.type === "ally") {
      if (allied) return { ok: false, state, reason: "These nations are already allied." };
      const retryAt = state.allianceCooldowns?.[id] ?? 0;
      if (state.tick < retryAt) return { ok: false, state, reason: `Wait ${retryAt - state.tick} game seconds before proposing again.` };
      if ((state.pendingAlliances ?? []).some(proposal => allianceId(proposal.proposer, proposal.responder) === id)) return { ok: false, state, reason: "An alliance proposal is already being considered." };
      const attempt = (state.allianceAttempts?.[id] ?? 0) + 1;
      const proposal = { proposer: command.player, responder: command.with, resolveAt: state.tick + 5, roll: allianceRoll(state.map.seed, command.player, command.with, attempt) };
      return { ok: true, state: withEvent({ ...state, allianceAttempts: { ...state.allianceAttempts, [id]: attempt }, pendingAlliances: [...(state.pendingAlliances ?? []), proposal] }, `${getPlayerName(command.with)} is considering an alliance proposal.`) };
    }
    if (!allied) return { ok: false, state, reason: "These nations are not allied." };
    const tradeRoutes = state.tradeRoutes.filter((route) => allianceId(route.player, route.recipient) !== id);
    return { ok: true, state: withEvent({ ...state, alliances: state.alliances.filter((alliance) => alliance !== id), tradeRoutes }, `${getPlayerName(command.player)} ended the alliance with ${getPlayerName(command.with)}.`) };
  }
  const territories = copyTerritories(state.territories);
  if (command.type === "research") {
    const territory = territories[command.territory];
    if (!territory || territory.owner !== command.player) return { ok: false, state, reason: "Research belongs to a province you control." };
    const skill = getSkill(command.skill);
    if (!skill) return { ok: false, state, reason: "Unknown population skill." };
    const reason = skillLockReason(territory, skill, state.tradeCredits[command.player]);
    if (reason) return { ok: false, state, reason };
    const learned = learnSkill({ ...state, territories }, command.territory, command.player, skill.id);
    // Learning the planned skill by hand completes the plan; any other step keeps it.
    return { ok: true, state: territory.researchGoal ? progressGoalAfterManualLearn(learned, command.territory) : learned };
  }
  if (command.type === "planResearch") {
    const territory = territories[command.territory];
    if (!territory || territory.owner !== command.player) return { ok: false, state, reason: "Plan research in a province you control." };
    const label = getTerritory(state.map, command.territory).label;
    if (command.skill === null) {
      if (!territory.researchGoal) return { ok: false, state, reason: "This province has no research plan." };
      delete territory.researchGoal;
      return { ok: true, state: withEvent({ ...state, territories }, `${label} cancelled its research plan.`) };
    }
    const skill = getSkill(command.skill);
    if (!skill) return { ok: false, state, reason: "Unknown population skill." };
    if (territory.skills?.includes(skill.id)) return { ok: false, state, reason: "Already learned" };
    const { problem } = researchPath(territory, skill.id);
    if (problem) return { ok: false, state, reason: `Cannot plan ${skill.name}: ${problem}.` };
    territory.researchGoal = skill.id;
    return { ok: true, state: progressResearchGoal(withEvent({ ...state, territories }, `${label} plans to research ${skill.name}.`), command.territory) };
  }
  if (command.type === "upgrade") {
    const territory = territories[command.territory];
    if (!territory || territory.owner !== command.player) return { ok: false, state, reason: "Manage population only in your territories." };
    const level = territory.upgrades[command.upgrade] ?? 0;
    if (level >= 3) return { ok: false, state, reason: "This branch is fully developed." };
    if (command.upgrade === "industry" && (territory.upgrades.housing ?? 0) < 1) return { ok: false, state, reason: "Build Neighborhoods I first." };
    if (command.upgrade === "militia" && (territory.upgrades.industry ?? 0) < 1) return { ok: false, state, reason: "Build Workshops I first." };
    const cost = upgradeCost(level);
    if (state.tradeCredits[command.player] < cost) return { ok: false, state, reason: `You need ${cost} trade credits.` };
    territory.upgrades = { ...territory.upgrades, [command.upgrade]: level + 1 };
    return { ok: true, state: withEvent({ ...state, territories, tradeCredits: { ...state.tradeCredits, [command.player]: state.tradeCredits[command.player] - cost } }, `${command.player} improved ${UPGRADE_NAMES[command.upgrade]} in ${getTerritory(state.map, command.territory).label}.`) };
  }
  if (command.type === "build") {
    const territory = territories[command.territory];
    if (!territory || territory.owner !== command.player) return { ok: false, state, reason: "Build only in one of your territories." };
    if (territory.buildings.includes(command.building)) return { ok: false, state, reason: "That territory already has this infrastructure." };
    const cost = buildingCost(territory, command.building);
    if (state.tradeCredits[command.player] < cost) return { ok: false, state, reason: `You need ${cost} trade credits.` };
    territory.buildings = [...territory.buildings, command.building];
    return { ok: true, state: withEvent({ ...state, territories, tradeCredits: { ...state.tradeCredits, [command.player]: state.tradeCredits[command.player] - cost } }, `${command.player} built ${BUILDING_NAMES[command.building]} in ${getTerritory(state.map, command.territory).label}.`) };
  }
  if (command.type === "fortify") {
    const territory = territories[command.territory];
    if (!territory || territory.owner !== command.player) return { ok: false, state, reason: "Choose one of your territories." };
    if (territory.units < 3) return { ok: false, state, reason: "Fortify requires 3 units." };
    if (territory.fortification >= MAX_FORTIFICATION) return { ok: false, state, reason: "That territory is fully fortified." };
    territory.units -= 2; territory.fortification += 1;
    return { ok: true, state: withEvent({ ...state, territories }, `${command.player} fortified ${getTerritory(state.map, command.territory).label}.`) };
  }
  if (command.type === "trade") {
    const problem = tradeProblem(state, command.player, command.from, command.to);
    if (problem) return { ok: false, state, reason: problem };
    const target = territories[command.to];
    const id = linkId(command.from, command.to);
    if (state.tradeRoutes.some((route) => route.id === id && activeTradeRoute(state, route))) return { ok: false, state, reason: "That trade route already exists." };
    return { ok: true, state: withEvent({ ...state, tradeRoutes: [...state.tradeRoutes.filter(route => route.id !== id), { id, from: command.from, to: command.to, player: command.player, recipient: target.owner! }] }, `${getPlayerName(command.player)} opened a trade route to ${getTerritory(state.map, command.to).label}.`) };
  }
  const origin = getTerritory(state.map, command.from);
  const bySea = canSail(state.map, origin, getTerritory(state.map, command.to));
  if (!origin.neighbours.includes(command.to) && !bySea) return { ok: false, state, reason: "Those territories have no shared frontier or sea route." };
  const source = territories[command.from]; const target = territories[command.to];
  if (source.owner !== command.player) return { ok: false, state, reason: "Choose one of your territories first." };
  if (command.type === "supply") {
    if (bySea) return { ok: false, state, reason: "Supply routes require a shared land frontier. Islands receive supplies by sea while connected to your capital." };
    if (target.owner !== command.player) return { ok: false, state, reason: "Supply routes connect friendly territories." };
    const route = linkId(command.from, command.to);
    if (state.suppliedLinks.includes(route)) return { ok: false, state, reason: "That supply route is already active." };
    if (source.units < 4) return { ok: false, state, reason: "Supply routes require 4 units." };
    source.units -= 3; target.units += 1;
    return { ok: true, state: withEvent(withRoad({ ...state, territories, suppliedLinks: [...state.suppliedLinks, route] }, command.from, command.to), `${command.player} opened a supply route to ${getTerritory(state.map, command.to).label}.`) };
  }
  if (target.owner && areAllied(state, command.player, target.owner)) return { ok: false, state, reason: "End the alliance before attacking that nation." };
  if (source.units < 2) return { ok: false, state, reason: "Keep at least one unit behind to defend the territory." };
  const attackers = command.units ?? Math.floor(source.units / 2);
  if (!Number.isInteger(attackers) || attackers < 1 || attackers >= source.units) return { ok: false, state, reason: "Choose a whole number of units and leave at least one behind." };
  source.units -= attackers;
  const byRoad = !bySea && target.owner === command.player;
  const roadSupport = !bySea && origin.neighbours.some((neighbour) => territories[neighbour].owner === command.player);
  const defence = defenceOf(state, command.to, target);
  const movement = { from: command.from, to: command.to, player: command.player, units: attackers, bySea, byRoad };
  if (bySea) {
    const invasion = { id: `${state.tick}-${state.invasions.length}-${command.from}-${command.to}`, from: command.from, to: command.to, player: command.player, units: attackers, attackBonus: populationEffects(source).attack, launchedTick: state.tick, arrivalTick: state.tick + 3 };
    return { ok: true, state: withEvent({ ...state, territories, invasions: [...state.invasions, invasion] }, `${command.player} launched ${attackers} units by sea toward ${getTerritory(state.map, command.to).label}.`, movement) };
  }
  if (target.owner === command.player) {
    target.units += attackers;
    return { ok: true, state: withEvent({ ...state, territories }, `${command.player} moved ${attackers} units along the road to ${getTerritory(state.map, command.to).label}.`, movement) };
  }
  const attackPower = attackers + (roadSupport ? 1 : 0) + populationEffects(source).attack;
  const fought = recordBattle({ ...state, territories }, command.to, command.player, target.owner, attackPower > defence);
  if (attackPower > defence) {
    const previousOwner = target.owner; target.owner = command.player; target.units = Math.max(1, attackers + (roadSupport ? 1 : 0) - defence); target.population = Math.max(12, Math.floor(target.population * 0.78)); target.fortification = 0; delete target.researchGoal;
    const message = previousOwner ? `${command.player} captured ${getTerritory(state.map, command.to).label}.` : `${command.player} claimed ${getTerritory(state.map, command.to).label}.`;
    return { ok: true, state: withEvent(withRoad(fought, command.from, command.to), message, movement, { territory: command.to, from: command.from, player: command.player, previousOwner }) };
  }
  target.units = Math.min(target.units, Math.max(1, defence - attackPower));
  return { ok: true, state: withEvent(fought, `${command.player}'s attack was repelled.`, movement) };
}

export function advanceGame(state: GameState): GameState {
  if (state.winner) return state;
  let next: GameState = { ...state, tick: state.tick + 1, territories: copyTerritories(state.territories), tradeCredits: { ...state.tradeCredits } };
  if (next.recentBattles?.length) next.recentBattles = next.recentBattles.filter(b => next.tick - b.tick < BATTLE_REPORT_TICKS);
  if (next.tick % PRODUCTION_INTERVAL === 0) for (const definition of next.map.territories) {
    const territory = next.territories[definition.id];
    const effects = populationEffects(territory);
    if (territory.owner && isPlayerAlive(next, territory.owner) && (effects.autonomous || isConnectedToCapital(next, definition.id, territory.owner))) {
      territory.development = (territory.development ?? 0) + developmentRate(territory, definition.terrain);
      territory.population += effects.growth + terrainEffects(definition.terrain).growth;
      territory.units += effects.units;
      if (next.tick % 9 === 0) {
        next.tradeCredits[territory.owner] += effects.income;
        territory.fortification = Math.min(MAX_FORTIFICATION, territory.fortification + effects.recovery);
      }
      territory.population += (definition.capitalFor ? 3 : 1) + (territory.buildings.includes("housing") ? 2 : 0) + (territory.buildings.includes("railway") ? 1 : 0) + (territory.upgrades.housing ?? 0);
      const supplyBonus = definition.neighbours.some((neighbour) => next.territories[neighbour].owner === territory.owner && next.suppliedLinks.includes(linkId(definition.id, neighbour))) ? 1 : 0;
      territory.units += 1 + supplyBonus + (territory.buildings.includes("factory") ? 1 : 0) + (territory.upgrades.industry ?? 0);
      territory.fortification = Math.min(MAX_FORTIFICATION, territory.fortification + ((territory.upgrades.militia ?? 0) >= 2 && next.tick % 9 === 0 ? 1 : 0));
      if (territory.researchGoal) next = progressResearchGoal(next, definition.id);
    }
  }
  next.tradeRoutes = next.tradeRoutes.filter(route => activeTradeRoute(next, route));
  if (next.tick % PRODUCTION_INTERVAL === 0) for (const route of next.tradeRoutes) {
    const recipient = route.recipient;
    const sourceBonus = populationEffects(next.territories[route.from]).trade;
    const targetBonus = populationEffects(next.territories[route.to]).trade;
    next.territories[route.from].population += 1;
    next.territories[route.to].population += 1;
    next.tradeCredits[route.player] += 2 + sourceBonus;
    next.tradeCredits[recipient] += 2 + targetBonus;
  }
  const arrivals = next.invasions.filter((invasion) => invasion.arrivalTick <= next.tick);
  next.invasions = next.invasions.filter((invasion) => invasion.arrivalTick > next.tick);
  for (const invasion of arrivals) {
    if (!isPlayerAlive(next, invasion.player)) continue;
    const target = next.territories[invasion.to];
    if (target.owner && areAllied(next, invasion.player, target.owner)) {
      if (next.territories[invasion.from].owner === invasion.player) next.territories[invasion.from].units += invasion.units;
      continue;
    }
    if (target.owner === invasion.player) { target.units += invasion.units; next = withEvent(next, `${invasion.player} reinforced ${getTerritory(next.map, invasion.to).label} by sea.`); continue; }
    const defence = defenceOf(next, invasion.to, target);
    const attackPower = invasion.units + (invasion.attackBonus ?? 0);
    next = recordBattle(next, invasion.to, invasion.player, target.owner, attackPower > defence);
    if (attackPower > defence) {
      const previousOwner = target.owner;
      target.owner = invasion.player; target.units = Math.max(1, invasion.units - defence); target.population = Math.max(12, Math.floor(target.population * 0.78)); target.fortification = 0; delete target.researchGoal;
      next = withEvent(next, `${invasion.player} landed and captured ${getTerritory(next.map, invasion.to).label}.`, undefined, { territory: invasion.to, from: invasion.from, player: invasion.player, previousOwner });
    } else {
      target.units = Math.min(target.units, Math.max(1, defence - attackPower));
      next = withEvent(next, `${invasion.player}'s landing at ${getTerritory(next.map, invasion.to).label} was repelled.`);
    }
  }
  const proposals = next.pendingAlliances ?? [];
  next.pendingAlliances = proposals.filter(proposal => proposal.resolveAt > next.tick && isPlayerAlive(next, proposal.proposer) && isPlayerAlive(next, proposal.responder));
  for (const proposal of proposals) {
    const alive = isPlayerAlive(next, proposal.proposer) && isPlayerAlive(next, proposal.responder);
    if (alive && proposal.resolveAt > next.tick) continue;
    const decision = alive ? evaluateAlliance(next, proposal.proposer, proposal.responder, proposal.roll) : { accepted: false, reason: "The proposal was cancelled because a capital fell." };
    const id = allianceId(proposal.proposer, proposal.responder);
    if (decision.accepted && !areAllied(next, proposal.proposer, proposal.responder)) next.alliances = [...next.alliances, id];
    if (!decision.accepted && alive) next.allianceCooldowns = { ...next.allianceCooldowns, [id]: next.tick + 30 };
    const result = { id: `${id}:${proposal.resolveAt}`, proposer: proposal.proposer, responder: proposal.responder, ...decision };
    const message = `${getPlayerName(proposal.responder)} ${decision.accepted ? "accepted" : "declined"} the alliance. ${decision.reason}`;
    next = { ...next, diplomacyResults: [...(next.diplomacyResults ?? []), result].slice(-20), events: [{ tick: next.tick, message, diplomacy: result }, ...next.events].slice(0, EVENT_LIMIT) };
  }
  const activePlayers = getMatchPlayers(next).filter((player) => isPlayerAlive(next, player));
  if (activePlayers.length === 0) return withEvent({ ...next, winner: "draw" }, "No capitals remain. The match is a draw.");
  if (activePlayers.length === 1) return withEvent({ ...next, winner: activePlayers[0] }, `${getPlayerName(activePlayers[0])} controls the frontier.`);
  if (next.tick >= next.maxTicks) {
    const ranked = activePlayers.map((player) => ({ player, score: controlScore(next, player) })).sort((a, b) => b.score - a.score);
    const winner: PlayerId | "draw" = ranked[0].score === ranked[1].score ? "draw" : ranked[0].player;
    return withEvent({ ...next, winner }, winner === "draw" ? "Time expired. The match is a draw." : `Time expired. ${getPlayerName(winner)} controls the frontier.`);
  }
  return next;
}

export function getControlScore(state: GameState, player: PlayerId): number { return controlScore(state, player); }
