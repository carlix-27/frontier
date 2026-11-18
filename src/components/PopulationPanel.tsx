import { useState } from "react";
import { Users, Coins, Sprout, Landmark, Shield, Check, LockKeyhole, X, Sparkles, GitBranch, Swords, Factory, GraduationCap, CircleHelp } from "lucide-react";
import { getTerritory } from "../engine/map";
import { isPlayerAlive } from "../engine/players";
import { developmentRate, MAX_POPULATION_SKILLS, POPULATION_BRANCHES, POPULATION_SKILLS, populationEffects, skillLockReason, type SkillBranch } from "../engine/population";
import type { GameCommand, GameState } from "../engine/types";

const icons = { economy: Coins, civil: Sprout, politics: Landmark, defence: Shield };
export function PopulationPanel({ game, territoryId, onCommand, onClose }: { game: GameState; territoryId: string; onCommand: (command: GameCommand) => unknown; onClose: () => void }) {
  const [branch, setBranch] = useState<SkillBranch>("economy");
  const territory = game.territories[territoryId];
  const learned = territory.skills ?? [];
  const effects = populationEffects(territory);
  const credits = game.tradeCredits.human;
  const readOnly = !!game.winner || territory.owner !== "human" || !isPlayerAlive(game, "human");
  const currentBranch = POPULATION_BRANCHES.find(b => b.id === branch)!;
  return <section className="population-workshop" aria-label="Province skill tree">
    <header className="population-heading"><div><p className="eyebrow">POPULATION • PROVINCE DEVELOPMENT</p><h2>{getTerritory(game.map, territoryId).label}</h2></div><button onClick={onClose} aria-label="Close population management"><X size={18} /></button></header>
    <div className="population-resources"><span><Users size={17} /><strong>{territory.population.toLocaleString()}</strong><small>citizens</small></span><span><Sparkles size={17} /><strong>{territory.development ?? 0}</strong><small>local points</small></span><span><Coins size={17} /><strong>{credits}</strong><small>national credits</small></span></div>
    <p className="population-explainer">Your citizens generate <b>+{developmentRate(territory)} development / cycle</b> while producing. Every 150 citizens adds +1. Research never consumes citizens.</p>
    <div className="population-capacity"><span><GitBranch size={15} />{learned.length}/{MAX_POPULATION_SKILLS} choices used</span><progress value={learned.length} max={MAX_POPULATION_SKILLS} aria-label="Province skill choices used" /></div>
    {readOnly && <p className="population-notice" role="status">{game.winner ? "Match finished. This tree is read-only." : "You no longer control this population. Its improvements remain here."}</p>}
    <nav className="population-branches" aria-label="Skill branches">{POPULATION_BRANCHES.map(item => {
      const Icon = icons[item.id];
      const skills = POPULATION_SKILLS.filter(s => s.branch === item.id);
      const available = skills.filter(s => !skillLockReason(territory, s, credits)).length;
      return <button key={item.id} onClick={() => setBranch(item.id)} aria-pressed={branch === item.id} className={branch === item.id ? "selected" : ""}><Icon size={19} /><strong>{item.name}</strong><small>{skills.filter(s => learned.includes(s.id)).length}/5 learned{available && !readOnly ? ` · ${available} ready` : ""}</small></button>;
    })}</nav>
    <div className="population-branch-heading"><h3>{currentBranch.name}</h3><p>{currentBranch.description}</p></div>
    <div className="population-tree">{POPULATION_SKILLS.filter(skill => skill.branch === branch).map(skill => {
      const owned = learned.includes(skill.id);
      const reason = skillLockReason(territory, skill, credits);
      const exclusive = !!skill.excludes;
      const Icon = owned ? Check : reason ? LockKeyhole : icons[branch];
      return <article key={skill.id} className={`population-skill tier-${skill.tier}${owned ? " learned" : !reason && !readOnly ? " available" : " locked"}`}>
        <div className="population-skill-title"><Icon size={18} /><strong>{skill.name}</strong></div>
        <small className="population-tier">Tier {skill.tier}{exclusive ? " · CHOOSE ONE" : ""} · {skill.population}+ citizens</small>
        <p>{skill.description}</p>
        <button disabled={!!reason || readOnly} onClick={() => onCommand({ type: "research", player: "human", territory: territoryId, skill: skill.id })} aria-label={`Learn ${skill.name}`}><span>{owned ? "Learned" : `${skill.points} pts · ${skill.credits} cr`}</span>{owned ? <Check size={14} /> : <Sparkles size={14} />}</button>
        {!owned && reason && <small className="population-lock">{reason}</small>}
      </article>;
    })}</div>
    <details className="population-effects" open><summary><Factory size={16} /> Active local bonuses</summary><ul>
      <li><Users size={14} /> +{effects.growth} citizens / cycle</li><li><Swords size={14} /> +{effects.units} units / cycle</li>
      <li><Coins size={14} /> +{effects.income} credits / 9 seconds</li><li><Coins size={14} /> +{effects.trade} credits / delivery</li>
      <li><Shield size={14} /> +{effects.defence} defence · +{effects.attack} attack</li><li><GraduationCap size={14} /> +{effects.research} development / cycle</li>
      {effects.discount > 0 && <li>Infrastructure discount: {effects.discount} credits</li>}
      {effects.recovery > 0 && <li>Repairs +{effects.recovery} fortification / 9 seconds</li>}
      {effects.autonomous > 0 && <li>Production continues without a capital connection</li>}
    </ul><small>Skill bonuses only. A cycle is 3 game seconds; buildings and supply add their own benefits.</small></details>
    <p className="population-footnote"><CircleHelp size={15} /> Choices are permanent for this province during this match, survive conquest, and reset next match. Final specializations exclude their sibling.</p>
  </section>;
}
