import { describe, expect, it } from "vitest";
import { advanceGame, applyCommand, buildingCost, createInitialGame, createRematch } from "./game";
import { developmentRate, getSkill, MAX_POPULATION_SKILLS, POPULATION_SKILLS, populationEffects, skillLockReason, type SkillId } from "./population";
import { chooseBotCommand } from "../bots/basicBot";
import type { GameState, TerritoryState } from "./types";

function fixture() {
  const game = createInitialGame();
  const capital = game.map.territories.find(t => t.capitalFor === "human")!;
  game.territories[capital.id] = { ...game.territories[capital.id], development: 200 };
  game.tradeCredits.human = 100;
  return { game, id: capital.id };
}
function learn(game: GameState, id: string, skill: SkillId): GameState {
  const result = applyCommand(game, { type: "research", player: "human", territory: id, skill });
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
const cycle = (game: GameState) => advanceGame({ ...game, tick: 8 });

describe("province skill trees", () => {
  it("has 24 unique skills with valid lower-tier prerequisites and symmetric exclusions", () => {
    expect(new Set(POPULATION_SKILLS.map(s => s.id)).size).toBe(24);
    for (const skill of POPULATION_SKILLS) {
      for (const id of skill.requires) expect(getSkill(id)!.tier).toBeLessThan(skill.tier);
      if (skill.excludes) expect(getSkill(skill.excludes)!.excludes).toBe(skill.id);
      expect(Object.values(skill.effects).some(value => value > 0)).toBe(true);
    }
  });
  it("spends local points and shared credits atomically, without consuming citizens", () => {
    const { game, id } = fixture();
    const market = learn(game, id, "market");
    const guilds = learn(market, id, "guilds");
    expect(guilds.territories[id].development).toBe(188);
    expect(guilds.tradeCredits.human).toBe(98);
    expect(guilds.territories[id].population).toBe(game.territories[id].population);
    expect(game.territories[id].skills).toBeUndefined();
    const duplicate = applyCommand(guilds, { type: "research", player: "human", territory: id, skill: "guilds" });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.state).toBe(guilds);
  });
  it("checks ownership, population, points, credits, prerequisites, defeat and match end", () => {
    const { game, id } = fixture();
    for (const state of [
      { ...game, winner: "human" as const },
      { ...game, territories: { ...game.territories, [id]: { ...game.territories[id], owner: "bot" as const } } },
      { ...game, territories: { ...game.territories, [id]: { ...game.territories[id], population: 10 } } },
      { ...game, territories: { ...game.territories, [id]: { ...game.territories[id], development: 0 } } },
    ]) expect(applyCommand(state, { type: "research", player: "human", territory: id, skill: "market" }).ok).toBe(false);
    expect(applyCommand(game, { type: "research", player: "human", territory: id, skill: "bank" }).ok).toBe(false);
    const market = learn(game, id, "market");
    market.tradeCredits.human = 0;
    expect(applyCommand(market, { type: "research", player: "human", territory: id, skill: "guilds" }).ok).toBe(false);
  });
  it("enforces exclusive specializations and the twelve-choice budget", () => {
    let { game, id } = fixture();
    for (const skill of ["market", "guilds", "docks", "bank", "freeport"] as SkillId[]) game = learn(game, id, skill);
    expect(applyCommand(game, { type: "research", player: "human", territory: id, skill: "industrial-hub" }).ok).toBe(false);
    const full: TerritoryState = { ...game.territories[id], skills: POPULATION_SKILLS.filter(s => s.id !== "sanitation").slice(0, MAX_POPULATION_SKILLS).map(s => s.id) };
    expect(skillLockReason(full, getSkill("sanitation")!, 100)).toContain("12");
  });
  it("lets every defined skill be learned through its declared prerequisites", () => {
    for (const skill of POPULATION_SKILLS) {
      let { game, id } = fixture();
      const visit = (skillId: SkillId) => {
        if (game.territories[id].skills?.includes(skillId)) return;
        getSkill(skillId)!.requires.forEach(visit);
        game = learn(game, id, skillId);
      };
      visit(skill.id);
      expect(game.territories[id].skills).toContain(skill.id);
    }
  });
  it("applies growth, recruitment, research and income only to the developed province", () => {
    const { game, id } = fixture();
    const neighbor = game.map.territories.find(t => t.id === game.map.territories.find(t => t.id === id)!.neighbours[0])!;
    game.territories[neighbor.id].owner = "human";
    const developed = learn(learn(learn(learn(game, id, "market"), id, "guilds"), id, "sanitation"), id, "schools");
    const base = cycle(game), next = cycle(developed);
    expect(next.territories[id].population - base.territories[id].population).toBe(3);
    expect(next.territories[id].units - base.territories[id].units).toBe(1);
    expect(next.tradeCredits.human - developed.tradeCredits.human).toBe(1);
    expect(next.territories[id].development! - developed.territories[id].development!).toBe(developmentRate(developed.territories[id]));
    expect(next.territories[neighbor.id]).toEqual(base.territories[neighbor.id]);
    expect(developmentRate({ ...game.territories[id], population: 150 })).toBe(developmentRate({ ...game.territories[id], population: 149 }) + 1);
  });
  it("discounts construction locally and never reduces a price below one credit", () => {
    const { game, id } = fixture();
    const developed = learn(learn(game, id, "council"), id, "public-works");
    developed.tradeCredits.human = 5;
    const built = applyCommand(developed, { type: "build", player: "human", territory: id, building: "factory" });
    expect(built.ok).toBe(true);
    expect(built.state.tradeCredits.human).toBe(0);
    expect(buildingCost(developed.territories[id], "housing")).toBe(2);
    expect(buildingCost(game.territories[id], "factory")).toBe(7);
  });
  it("uses local trade bonuses without granting them to the other nation", () => {
    let { game, id } = fixture();
    game = learn(learn(game, id, "market"), id, "docks");
    const other = game.map.territories.find(t => t.capitalFor === "bot")!.id;
    const alliance = applyCommand(game, { type: "ally", player: "human", with: "bot" }).state;
    const route = applyCommand(alliance, { type: "trade", player: "human", from: id, to: other }).state;
    const next = advanceGame({ ...route, tick: 2 });
    expect(next.tradeCredits.human - route.tradeCredits.human).toBe(3);
    expect(next.tradeCredits.bot - route.tradeCredits.bot).toBe(2);
  });
  it("allows an autonomous province to produce while disconnected", () => {
    const { game } = fixture();
    const island = game.map.territories.find(t => t.island)!;
    const ordinary = { ...game, territories: { ...game.territories, [island.id]: { ...game.territories[island.id], owner: "human" as const } } };
    expect(cycle(ordinary).territories[island.id].population).toBe(ordinary.territories[island.id].population);
    const autonomous = { ...ordinary, territories: { ...ordinary.territories, [island.id]: { ...ordinary.territories[island.id], skills: ["autonomy"] as SkillId[] } } };
    expect(cycle(autonomous).territories[island.id].population).toBeGreaterThan(ordinary.territories[island.id].population);
  });
  it("keeps captured skills and clears all progress on replay", () => {
    const { game, id } = fixture();
    const from = game.map.territories.find(t => t.id === id)!;
    const targetId = from.neighbours[0];
    game.territories[id].units = 100;
    game.territories[targetId].skills = ["sanitation"];
    game.territories[targetId].development = 7;
    const result = applyCommand(game, { type: "expand", player: "human", from: id, to: targetId, units: 50 });
    expect(result.state.territories[targetId].skills).toEqual(["sanitation"]);
    expect(result.state.territories[targetId].development).toBe(7);
    expect(Object.values(createRematch(result.state).territories).every(t => !t.skills?.length && !t.development)).toBe(true);
  });
  it("applies attack and defence to naval and land combat, and repairs bastions", () => {
    for (const sea of [false, true]) {
      const { game, id } = fixture();
      const from = game.map.territories.find(t => sea ? t.seaNeighbours.length > 0 : t.id === id)!;
      const targetId = (sea ? from.seaNeighbours : from.neighbours)[0];
      game.territories[from.id] = { ...game.territories[from.id], owner: "human", units: 20, skills: ["expedition"] };
      game.territories[targetId] = { ...game.territories[targetId], units: 6, fortification: 0, skills: ["watch"] };
      const result = applyCommand(game, { type: "expand", player: "human", from: from.id, to: targetId, units: 5 });
      const next = sea ? advanceGame(result.state) : result.state;
      expect(next.territories[targetId].owner).toBe("human");
      expect(next.territories[targetId].units).toBeLessThanOrEqual(5);
    }
    const { game, id } = fixture();
    game.territories[id].skills = ["bastion"];
    expect(cycle(game).territories[id].fortification).toBe(2);
    expect(populationEffects(game.territories[id]).defence).toBe(3);
  });
  it("gives bots access to the same research command without free unlocks", () => {
    const { game, id } = fixture();
    game.tick = 6;
    for (const territory of Object.values(game.territories)) territory.units = 1;
    const command = chooseBotCommand(game, "normal", "human");
    expect(command?.type).toBe("research");
    const next = applyCommand(game, command!).state;
    expect(next.territories[id].development).toBeLessThan(game.territories[id].development!);
  });
});
