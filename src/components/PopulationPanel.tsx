import { useEffect, useState } from "react";
import { Users, Coins, Sprout, Landmark, Shield, Check, LockKeyhole, X, Sparkles, GitBranch, Swords, Factory, GraduationCap, CircleHelp, Target, Flag, Mountain, Ban, Clock } from "lucide-react";
import { provinceRole, type ProvinceRole } from "../bots/basicBot";
import { getTerritory } from "../engine/map";
import { isPlayerAlive } from "../engine/players";
import { CYCLE_SECONDS, developmentRate, getSkill, MAX_POPULATION_SKILLS, POPULATION_BRANCHES, POPULATION_SKILLS, populationEffects, researchEstimate, researchPath, skillLockReason, skillRequirements, type PopulationEffects, type PopulationSkill, type SkillBranch, type SkillId } from "../engine/population";
import { terrainEffects, TERRAINS } from "../engine/terrain";
import type { GameCommand, GameState, TerritoryState } from "../engine/types";

const icons = { economy: Coins, civil: Sprout, politics: Landmark, defence: Shield };
const roleNames: Record<ProvinceRole, { name: string; hint: string }> = {
  capital: { name: "Capital", hint: "Your seat of government. Growth here compounds." },
  front: { name: "Frontier", hint: "Borders a rival nation. Defence and attack pay off here." },
  interior: { name: "Interior", hint: "Safe from rivals. A good place for economy and production." },
};
/** Node centres in the tree, in percent: tier 1, two tier-2 paths, tier 3, two exclusive tier-4 choices. */
const POSITIONS: [number, number][] = [[50, 12.5], [25, 37.5], [75, 37.5], [50, 62.5], [25, 87.5], [75, 87.5]];
const EFFECT_LABELS: Record<keyof PopulationEffects, (value: number) => string> = {
  growth: (v) => `+${v} citizens / cycle`,
  units: (v) => `+${v} units / cycle`,
  income: (v) => `+${v} credits / 9 s`,
  trade: (v) => `+${v} credits / delivery`,
  research: (v) => `+${v} development / cycle`,
  defence: (v) => `+${v} defence`,
  attack: (v) => `+${v} attack power`,
  discount: (v) => `−${v} credits on buildings`,
  recovery: (v) => `+${v} fortification / 9 s`,
  autonomous: () => "Produces without a capital link",
};

function effectList(effects: Partial<PopulationEffects>) {
  return (Object.entries(effects) as [keyof PopulationEffects, number][]).filter(([, value]) => value > 0).map(([key, value]) => EFFECT_LABELS[key](value));
}
function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}
function nodeState(territory: TerritoryState, skill: PopulationSkill, credits: number, readOnly: boolean, planned: Set<SkillId>) {
  const learned = territory.skills ?? [];
  if (learned.includes(skill.id)) return "learned";
  if (skill.excludes && learned.includes(skill.excludes)) return "excluded";
  if (!readOnly && !skillLockReason(territory, skill, credits)) return "available";
  if (planned.has(skill.id)) return "planned";
  return "locked";
}

interface Props { game: GameState; territoryId: string; onCommand: (command: GameCommand) => unknown; onClose: () => void }

export function PopulationPanel({ game, territoryId, onCommand, onClose }: Props) {
  const territory = game.territories[territoryId];
  const definition = getTerritory(game.map, territoryId);
  const learned = territory.skills ?? [];
  const credits = territory.owner ? game.tradeCredits[territory.owner] ?? 0 : 0;
  const readOnly = !!game.winner || territory.owner !== "human" || !isPlayerAlive(game, "human");
  const goal = territory.researchGoal;
  const goalPlan = goal ? researchPath(territory, goal) : null;
  const planned = new Set(goalPlan?.path ?? []);
  const [branch, setBranch] = useState<SkillBranch>(() => goal ? getSkill(goal)!.branch : "economy");
  const branchSkills = POPULATION_SKILLS.filter((skill) => skill.branch === branch);
  const defaultSkill = () => (branchSkills.find((skill) => !skillLockReason(territory, skill, credits)) ?? branchSkills.find((skill) => !learned.includes(skill.id)) ?? branchSkills[0]).id;
  const [selected, setSelected] = useState<SkillId>(defaultSkill);
  // Keep the detail card on the visible branch and reset it when another province opens.
  useEffect(() => { if (getSkill(selected)!.branch !== branch) setSelected(defaultSkill()); }, [branch]);
  useEffect(() => { setSelected(defaultSkill()); }, [territoryId]);

  const rate = developmentRate(territory, definition.terrain);
  const effects = populationEffects(territory);
  const terrain = definition.terrain ? TERRAINS[definition.terrain] : null;
  const terrainBonus = terrainEffects(definition.terrain);
  const role = territory.owner ? provinceRole(game, territory.owner, territoryId) : null;
  const skill = getSkill(selected)!;
  const state = nodeState(territory, skill, credits, readOnly, planned);
  const requirements = skillRequirements(territory, skill, credits);
  const lockReason = skillLockReason(territory, skill, credits);
  const path = researchPath(territory, skill.id);
  const estimate = researchEstimate(territory, skill.id, credits, rate);
  const goalEstimate = goal ? researchEstimate(territory, goal, credits, rate) : null;
  const research = (id: SkillId) => onCommand({ type: "research", player: "human", territory: territoryId, skill: id });
  const plan = (id: SkillId | null) => onCommand({ type: "planResearch", player: "human", territory: territoryId, skill: id });

  return <section className="population-workshop" aria-label="Province skill tree">
    <header className="population-heading">
      <div>
        <p className="eyebrow">PROVINCE DEVELOPMENT</p>
        <h2>{definition.label}</h2>
        <div className="province-chips">
          {role && <span className={`province-chip role-${role}`} title={roleNames[role].hint}><Flag size={12} />{roleNames[role].name}</span>}
          {terrain && <span className={`province-chip terrain-${terrain.id}`} title={terrain.description}><Mountain size={12} />{terrain.name}</span>}
        </div>
      </div>
      <button onClick={onClose} aria-label="Close population management"><X size={18} /></button>
    </header>
    <div className="population-resources">
      <span><Users size={17} /><strong>{territory.population.toLocaleString()}</strong><small>citizens</small></span>
      <span><Sparkles size={17} /><strong>{territory.development ?? 0}</strong><small>points · +{rate}/cycle</small></span>
      <span><Coins size={17} /><strong>{credits}</strong><small>national credits</small></span>
    </div>
    {readOnly && <p className="population-notice" role="status">{game.winner ? "Match finished. This tree is read-only." : "You no longer control this population. Its improvements remain here."}</p>}
    {goal && goalPlan && <div className="research-goal" role="status">
      <Target size={18} />
      <div>
        <strong>Plan: {getSkill(goal)!.name}</strong>
        <small>{goalPlan.path.length > 1 ? `Next: ${getSkill(goalPlan.path[0])!.name} · ${goalPlan.path.length} steps` : "Final step"}{goalEstimate && goalEstimate.pointsShort > 0 ? ` · ~${formatTime(goalEstimate.seconds)}` : ""}{goalEstimate && goalEstimate.creditsShort > 0 ? ` · ${goalEstimate.creditsShort} more credits` : ""}{goalEstimate && goalEstimate.populationShort > 0 ? ` · ${goalEstimate.populationShort} more citizens` : ""}</small>
      </div>
      {!readOnly && <button type="button" onClick={() => plan(null)} aria-label="Cancel research plan"><X size={14} /></button>}
    </div>}
    <div className="population-capacity"><span><GitBranch size={15} />{learned.length}/{MAX_POPULATION_SKILLS} choices used</span><progress value={learned.length} max={MAX_POPULATION_SKILLS} aria-label="Province skill choices used" /></div>
    <nav className="population-branches" aria-label="Skill branches">{POPULATION_BRANCHES.map((item) => {
      const Icon = icons[item.id];
      const skills = POPULATION_SKILLS.filter((candidate) => candidate.branch === item.id);
      const count = skills.filter((candidate) => learned.includes(candidate.id)).length;
      const ready = readOnly ? 0 : skills.filter((candidate) => !skillLockReason(territory, candidate, credits)).length;
      return <button key={item.id} onClick={() => setBranch(item.id)} aria-pressed={branch === item.id} className={branch === item.id ? "selected" : ""}>
        <Icon size={18} /><strong>{item.name}</strong>
        <span className="branch-progress" aria-hidden="true"><i style={{ width: `${count / 5 * 100}%` }} /></span>
        <small>{count}/5{ready ? ` · ${ready} ready` : ""}{goal && getSkill(goal)!.branch === item.id ? " · plan" : ""}</small>
      </button>;
    })}</nav>
    <p className="population-branch-description">{POPULATION_BRANCHES.find((item) => item.id === branch)!.description}</p>
    <div className="dev-tree" role="group" aria-label={`${branch} skill tree`}>
      <svg className="dev-tree-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {branchSkills.flatMap((child, index) => child.requires.map((parentId) => {
          const parentIndex = branchSkills.findIndex((candidate) => candidate.id === parentId);
          const [x1, y1] = POSITIONS[parentIndex], [x2, y2] = POSITIONS[index];
          const done = learned.includes(child.id) && learned.includes(parentId);
          const onPlan = planned.has(child.id) && (planned.has(parentId) || learned.includes(parentId));
          return <path key={`${parentId}-${child.id}`} d={`M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`} className={done ? "done" : onPlan ? "planned" : ""} vectorEffect="non-scaling-stroke" />;
        }))}
      </svg>
      {branchSkills.map((node, index) => {
        const nodeStatus = nodeState(territory, node, credits, readOnly, planned);
        const Icon = nodeStatus === "learned" ? Check : nodeStatus === "excluded" ? Ban : nodeStatus === "locked" ? LockKeyhole : nodeStatus === "planned" ? Target : icons[branch];
        return <button key={node.id} type="button" className={`dev-node tier-${node.tier} slot-${index} ${nodeStatus}${selected === node.id ? " selected" : ""}${goal === node.id ? " goal" : ""}`} onClick={() => setSelected(node.id)} aria-pressed={selected === node.id} aria-label={`${node.name}, tier ${node.tier}, ${nodeStatus}`}>
          <Icon size={15} />
          <strong>{node.name}</strong>
          <small>{nodeStatus === "learned" ? "Learned" : nodeStatus === "excluded" ? "Not chosen" : `${node.points} pts${node.credits ? ` · ${node.credits} cr` : ""}`}</small>
        </button>;
      })}
      <span className="dev-or" aria-hidden="true">OR</span>
    </div>
    <article className={`dev-detail ${state}`} aria-live="polite">
      <div className="dev-detail-heading"><div><small>Tier {skill.tier}{skill.excludes ? ` · exclusive with ${getSkill(skill.excludes)!.name}` : ""}</small><h3>{skill.name}</h3></div>{state === "learned" && <span className="dev-badge"><Check size={13} />Learned</span>}</div>
      <p>{skill.description}</p>
      <ul className="dev-effects">{effectList(skill.effects).map((label) => <li key={label}>{label}</li>)}</ul>
      {state !== "learned" && <ul className="dev-requirements" aria-label="Requirements">{requirements.map((requirement) => <li key={requirement.label} className={requirement.met ? "met" : "missing"}>{requirement.met ? <Check size={12} /> : <X size={12} />}{requirement.label}</li>)}</ul>}
      {state !== "learned" && state !== "excluded" && !path.problem && path.path.length > 1 && <p className="dev-eta"><Clock size={14} />{path.path.length} steps from here{estimate.pointsShort > 0 ? `: about ${formatTime(estimate.seconds)} of development at +${rate}/cycle` : ": enough development already"}{estimate.creditsShort > 0 ? `, plus ${estimate.creditsShort} credits` : ""}{estimate.populationShort > 0 ? `, ${estimate.populationShort} more citizens` : ""}.</p>}
      {state !== "learned" && path.problem && <p className="dev-eta blocked"><Ban size={14} />Unavailable: {path.problem}.</p>}
      {state !== "learned" && !readOnly && <div className="dev-actions">
        <button type="button" className="primary" disabled={!!lockReason} onClick={() => research(skill.id)}><Sparkles size={14} />{lockReason ? lockReason : `Learn now · ${skill.points} pts${skill.credits ? ` · ${skill.credits} cr` : ""}`}</button>
        {goal === skill.id ? <button type="button" onClick={() => plan(null)}><X size={14} />Cancel plan</button> : <button type="button" disabled={!!path.problem} onClick={() => plan(skill.id)} title="The province learns each missing step automatically as soon as it can afford it."><Target size={14} />{path.path.length > 1 ? `Plan path · ${path.path.length} steps` : "Auto-learn when ready"}</button>}
      </div>}
    </article>
    <details className="population-effects"><summary><Factory size={16} /> Active local bonuses</summary><ul>
      <li><Users size={14} /> +{effects.growth + terrainBonus.growth} citizens / cycle</li><li><Swords size={14} /> +{effects.units} units / cycle</li>
      <li><Coins size={14} /> +{effects.income} credits / 9 seconds</li><li><Coins size={14} /> +{effects.trade} credits / delivery</li>
      <li><Shield size={14} /> +{effects.defence + terrainBonus.defence} defence · +{effects.attack} attack</li><li><GraduationCap size={14} /> +{effects.research + terrainBonus.research} development / cycle</li>
      {effects.discount > 0 && <li>Infrastructure discount: {effects.discount} credits</li>}
      {effects.recovery > 0 && <li>Repairs +{effects.recovery} fortification / 9 seconds</li>}
      {effects.autonomous > 0 && <li>Production continues without a capital connection</li>}
    </ul><small>Skills and terrain only. A cycle is {CYCLE_SECONDS} game seconds; buildings and supply add their own benefits.{terrain ? ` ${terrain.name}: ${terrain.description}` : ""}</small></details>
    <p className="population-footnote"><CircleHelp size={15} /> Choices are permanent for this province during this match, survive conquest, and reset next match. A plan learns each missing step automatically and is dropped if the province changes hands.</p>
  </section>;
}
