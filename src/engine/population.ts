import type { TerritoryState } from "./types";

export type SkillBranch = "economy" | "civil" | "politics" | "defence";
export type SkillId = "market" | "guilds" | "docks" | "bank" | "freeport" | "industrial-hub" | "sanitation" | "granaries" | "schools" | "hospital" | "metropolis" | "university" | "council" | "census" | "public-works" | "charter" | "autonomy" | "cooperative" | "watch" | "drills" | "shelters" | "academy" | "bastion" | "expedition";
export interface PopulationEffects { growth: number; units: number; income: number; trade: number; research: number; defence: number; attack: number; discount: number; recovery: number; autonomous: number }
export interface PopulationSkill {
  id: SkillId; branch: SkillBranch; name: string; description: string; tier: number;
  points: number; credits: number; population: number; requires: SkillId[]; excludes?: SkillId;
  effects: Partial<PopulationEffects>;
}
export const MAX_POPULATION_SKILLS = 12;
export const POPULATION_BRANCHES: { id: SkillBranch; name: string; description: string }[] = [
  { id: "economy", name: "Economy", description: "Local revenue, industry and maritime commerce." },
  { id: "civil", name: "Civil development", description: "Health, education and a growing community." },
  { id: "politics", name: "Policies", description: "Choose how this province governs and develops." },
  { id: "defence", name: "Defence", description: "Protect citizens or train an expeditionary force." },
];
function skill(id: SkillId, branch: SkillBranch, name: string, description: string, tier: number, requires: SkillId[], effects: Partial<PopulationEffects>, excludes?: SkillId): PopulationSkill {
  return { id, branch, name, description, tier, requires, effects, excludes, points: [0, 4, 8, 12, 18][tier], credits: [0, 0, 2, 4, 6][tier], population: [0, 40, 60, 100, 140][tier] };
}
export const POPULATION_SKILLS: PopulationSkill[] = [
  skill("market", "economy", "Local market", "+1 credit every 9 game seconds.", 1, [], { income: 1 }),
  skill("guilds", "economy", "Artisan guilds", "+1 unit per production cycle.", 2, ["market"], { units: 1 }),
  skill("docks", "economy", "Trade offices", "+1 credit per delivery touching this province.", 2, ["market"], { trade: 1 }),
  skill("bank", "economy", "Municipal bank", "+2 credits every 9 game seconds. Requires both economic paths.", 3, ["guilds", "docks"], { income: 2 }),
  skill("freeport", "economy", "Free port", "+3 credits per local delivery. Excludes Industrial hub.", 4, ["bank"], { trade: 3 }, "industrial-hub"),
  skill("industrial-hub", "economy", "Industrial hub", "+3 units per cycle. Excludes Free port.", 4, ["bank"], { units: 3 }, "freeport"),
  skill("sanitation", "civil", "Clean water", "+3 citizens per production cycle.", 1, [], { growth: 3 }),
  skill("granaries", "civil", "Food reserves", "+4 citizens per cycle.", 2, ["sanitation"], { growth: 4 }),
  skill("schools", "civil", "Public schools", "+1 local development point per cycle.", 2, ["sanitation"], { research: 1 }),
  skill("hospital", "civil", "Public hospital", "+5 citizens per cycle. Requires food reserves and schools.", 3, ["granaries", "schools"], { growth: 5 }),
  skill("metropolis", "civil", "Metropolis", "+10 citizens per cycle. Excludes University city.", 4, ["hospital"], { growth: 10 }, "university"),
  skill("university", "civil", "University city", "+4 development points per cycle. Excludes Metropolis.", 4, ["hospital"], { research: 4 }, "metropolis"),
  skill("council", "politics", "Local council", "+1 local development point per cycle.", 1, [], { research: 1 }),
  skill("census", "politics", "Civic registry", "+2 citizens and +1 development point per cycle.", 2, ["council"], { growth: 2, research: 1 }),
  skill("public-works", "politics", "Public works", "Infrastructure built here costs 2 fewer credits (minimum 1).", 2, ["council"], { discount: 2 }),
  skill("charter", "politics", "Provincial charter", "+1 credit every 9 seconds and +1 development point per cycle.", 3, ["census", "public-works"], { income: 1, research: 1 }),
  skill("autonomy", "politics", "Self-government", "This province produces even when cut off from its capital. Excludes Cooperative.", 4, ["charter"], { autonomous: 1 }, "cooperative"),
  skill("cooperative", "politics", "Cooperative", "+5 citizens per cycle and +2 credits every 9 seconds. Excludes Self-government.", 4, ["charter"], { growth: 5, income: 2 }, "autonomy"),
  skill("watch", "defence", "Citizen watch", "+1 defence against land attacks and naval landings.", 1, [], { defence: 1 }),
  skill("drills", "defence", "Training grounds", "+1 unit per production cycle.", 2, ["watch"], { units: 1 }),
  skill("shelters", "defence", "Civil shelters", "+2 local defence.", 2, ["watch"], { defence: 2 }),
  skill("academy", "defence", "Military academy", "+1 attack power for armies departing here, by land or sea.", 3, ["drills", "shelters"], { attack: 1 }),
  skill("bastion", "defence", "Bastion", "+3 defence; repairs 1 fortification every 9 seconds. Excludes Expedition corps.", 4, ["academy"], { defence: 3, recovery: 1 }, "expedition"),
  skill("expedition", "defence", "Expedition corps", "+3 attack power and +1 unit per cycle. Excludes Bastion.", 4, ["academy"], { attack: 3, units: 1 }, "bastion"),
];
export const getSkill = (id: SkillId) => POPULATION_SKILLS.find(skill => skill.id === id);
export function populationEffects(territory: TerritoryState): PopulationEffects {
  const effects: PopulationEffects = { growth: 0, units: 0, income: 0, trade: 0, research: 0, defence: 0, attack: 0, discount: 0, recovery: 0, autonomous: 0 };
  for (const id of territory.skills ?? []) for (const [key, value] of Object.entries(getSkill(id)?.effects ?? {})) effects[key as keyof PopulationEffects] += value;
  return effects;
}
export const developmentRate = (territory: TerritoryState) => 1 + Math.floor(territory.population / 150) + populationEffects(territory).research;
export function skillLockReason(territory: TerritoryState, skill: PopulationSkill, credits: number): string | null {
  const learned = territory.skills ?? [];
  if (learned.includes(skill.id)) return "Already learned";
  if (skill.excludes && learned.includes(skill.excludes)) return `Exclusive with ${getSkill(skill.excludes)!.name}`;
  if (learned.length >= MAX_POPULATION_SKILLS) return "All 12 province choices used";
  const missing = skill.requires.filter(id => !learned.includes(id));
  if (missing.length) return `Requires ${missing.map(id => getSkill(id)!.name).join(" + ")}`;
  if (territory.population < skill.population) return `Requires ${skill.population} citizens`;
  if ((territory.development ?? 0) < skill.points) return `Needs ${skill.points} local development points`;
  if (credits < skill.credits) return `Needs ${skill.credits} trade credits`;
  return null;
}
