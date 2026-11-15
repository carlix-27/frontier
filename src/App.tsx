import { useEffect, useMemo, useState } from "react";
import { chooseBotCommand, type BotDifficulty } from "./bots/basicBot";
import { GameMap } from "./components/GameMap";
import { advanceGame, applyCommand, BUILDING_COSTS, BUILDING_NAMES, createInitialGame, getControlScore, getPopulation, UPGRADE_NAMES, upgradeCost } from "./engine/game";
import { getMapPreset, getTerritory, MAP_PRESETS } from "./engine/map";
import type { BuildingType, GameCommand, PlayerId, PopulationUpgrade, TerritoryId } from "./engine/types";

type ActionMode = "expand" | "fortify" | "supply" | "trade";

const descriptions: Record<ActionMode, string> = {
  expand: "Move half your force across a shared frontier.",
  fortify: "Spend 2 units to increase a territory's defence.",
  supply: "Open a route between adjacent friendly territories for faster growth.",
  trade: "Connect two friendly ports. Every delivery brings population and trade credits.",
};

const buildingCards: Array<{ building: BuildingType; icon: string; description: string }> = [
  { building: "housing", icon: "⌂", description: "+2 population every production cycle." },
  { building: "factory", icon: "▦", description: "+1 unit every production cycle." },
  { building: "railway", icon: "▰", description: "+1 population and a moving train." },
];

function defaultAttackForce(units: number): number { return Math.max(1, Math.min(3, units - 1)); }

export default function App() {
  const [game, setGame] = useState(() => createInitialGame());
  const [screen, setScreen] = useState<"home" | "setup" | "lobby" | "game">("home");
  const [mapChoice, setMapChoice] = useState<string>(MAP_PRESETS[0].id);
  const [duration, setDuration] = useState(300);
  const [managedTerritory, setManagedTerritory] = useState<TerritoryId | null>(null);
  const [contextMenu, setContextMenu] = useState<{ territory: TerritoryId; x: number; y: number } | null>(null);
  const [mode, setMode] = useState<ActionMode>("expand");
  const [selected, setSelected] = useState<TerritoryId | null>(null);
  const [attackUnits, setAttackUnits] = useState<number | null>(null);
  const [buildingToPlace, setBuildingToPlace] = useState<BuildingType | null>(null);
  const [difficulty, setDifficulty] = useState<BotDifficulty>("normal");
  const [demoMode, setDemoMode] = useState(true);
  const [paused, setPaused] = useState(false);
  const [hint, setHint] = useState("The two commanders are securing their capitals.");
  const scores = useMemo(() => ({
    human: getControlScore(game, "human"),
    bot: getControlScore(game, "bot"),
    population: getPopulation(game, "human"),
    credits: game.tradeCredits.human,
  }), [game]);

  function activateMode(action: ActionMode) {
    setMode(action); setSelected(null); setAttackUnits(null); setBuildingToPlace(null);
    setHint(action === "fortify" ? "Select a friendly region to fortify." : action === "trade" ? "Select a friendly departure port." : "Select a friendly region to begin.");
  }

  useEffect(() => {
    const timer = window.setInterval(() => setGame((current) => {
      if (screen !== "game" || paused || current.winner) return current;
      let next = advanceGame(current);
      const cadence = difficulty === "easy" ? 5 : difficulty === "normal" ? 3 : 2;
      if (!next.winner && next.tick % cadence === 0) {
        const commanders: PlayerId[] = demoMode ? ["human", "bot"] : ["bot"];
        for (const player of commanders) {
          const command = chooseBotCommand(next, difficulty, player);
          if (command) { const result = applyCommand(next, command); if (result.ok) next = result.state; }
          if (next.winner) break;
        }
      }
      return next;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [demoMode, difficulty, paused, screen]);

  useEffect(() => {
    const shortcuts: Record<string, ActionMode> = { "1": "expand", "2": "fortify", "3": "supply", "4": "trade" };
    function handleShortcut(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) return;
      if (screen !== "game" || event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
      const action = shortcuts[event.key];
      if (!action) return;
      event.preventDefault(); activateMode(action);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [screen]);

  function submit(command: GameCommand) {
    const result = applyCommand(game, command);
    if (!result.ok) { setHint(result.reason); return false; }
    setGame(result.state); setSelected(null); setAttackUnits(null); return true;
  }

  function beginConstruction(building: BuildingType) {
    const cost = BUILDING_COSTS[building];
    if (scores.credits < cost) { setHint(`You need ${cost} trade credits. Open routes and wait for deliveries.`); return; }
    setBuildingToPlace(building); setSelected(null); setHint(`Place ${BUILDING_NAMES[building]} in one of your territories.`);
  }

  function handleTerritory(id: TerritoryId) {
    if (game.winner) return;
    if (buildingToPlace) {
      if (submit({ type: "build", player: "human", territory: id, building: buildingToPlace })) { setBuildingToPlace(null); setHint("Construction complete. The city is growing."); }
      return;
    }
    if (mode === "fortify") { submit({ type: "fortify", player: "human", territory: id }); return; }
    if (!selected) {
      if (game.territories[id].owner !== "human") { setHint("Choose one of your own regions as the origin."); return; }
      setSelected(id); setAttackUnits(mode === "expand" ? defaultAttackForce(game.territories[id].units) : null); setHint(`Selected ${getTerritory(game.map, id).label}. ${mode === "trade" ? "Choose another friendly port." : mode === "expand" ? "Set your force, then choose a neighbouring region." : "Choose a neighbouring region."}`); return;
    }
    if (mode === "expand") submit({ type: "expand", player: "human", from: selected, to: id, units: attackUnits ?? defaultAttackForce(game.territories[selected].units) });
    else if (mode === "supply") submit({ type: "supply", player: "human", from: selected, to: id });
    else submit({ type: "trade", player: "human", from: selected, to: id });
  }

  function manageTerritory(id: TerritoryId) {
    if (game.territories[id].owner !== "human") { setHint("You can manage population only in a blue territory."); return; }
    setManagedTerritory(id); setContextMenu(null); setHint(`Managing population in ${getTerritory(game.map, id).label}.`);
  }

  function startMatch(forceDemo = demoMode) {
    const preset = getMapPreset(mapChoice);
    setDemoMode(forceDemo); setGame(createInitialGame(duration, preset.seed, preset.id)); setSelected(null); setAttackUnits(null); setBuildingToPlace(null); setManagedTerritory(null); setContextMenu(null); setPaused(false); setScreen("game");
    setHint(forceDemo ? "Blue and red commanders are fighting." : "Select a friendly region to begin. Right-click it to manage population.");
  }

  const remaining = Math.max(0, game.maxTicks - game.tick);
  const selectedUnits = selected ? game.territories[selected].units : 0;
  const maxAttackUnits = Math.max(1, selectedUnits - 1);
  const committedUnits = selected ? Math.min(attackUnits ?? defaultAttackForce(selectedUnits), maxAttackUnits) : 0;
  if (screen !== "game") return <main className="app-shell lobby-shell"><p className="eyebrow">FRONTIER · LOCAL PROTOTYPE</p><h1>Frontier</h1><p className="subtitle">Create a continent. Command its future.</p>
    {screen === "home" ? <section className="lobby-card"><h2>Choose your next match</h2><p>Play against bots on one of five fictional continents.</p><div className="lobby-actions"><button className="primary" onClick={() => setScreen("setup")}>Create match</button><button onClick={() => setScreen("lobby")}>Join local lobby</button></div><small>Online lobbies are planned; this prototype runs locally in your browser.</small></section> : screen === "lobby" ? <section className="lobby-card"><h2>Local lobby</h2><p>A practice table is ready with two bot commanders. Join to watch their match.</p><div className="lobby-actions"><button onClick={() => setScreen("home")}>Back</button><button className="primary" onClick={() => startMatch(true)}>Join practice match</button></div></section> : <section className="lobby-card"><h2>Create match</h2><p>Choose a map and rules before the clock starts.</p><div className="map-options">{MAP_PRESETS.map((preset) => <button key={preset.id} className={mapChoice === preset.id ? "map-option active" : "map-option"} onClick={() => setMapChoice(preset.id)}><strong>{preset.name}</strong><span>{preset.description}</span></button>)}</div><div className="match-options"><label>Duration<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={180}>3 minutes</option><option value={300}>5 minutes</option><option value={600}>10 minutes</option></select></label><label>Bot difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as BotDifficulty)}><option value="easy">Easy</option><option value="normal">Normal</option><option value="expert">Expert</option></select></label><label className="demo-toggle"><input type="checkbox" checked={demoMode} onChange={(event) => setDemoMode(event.target.checked)} />Blue auto-play (demo)</label></div><div className="lobby-actions"><button onClick={() => setScreen("home")}>Back</button><button className="primary" onClick={() => startMatch()}>Start match</button></div></section>}
  </main>;
  return <main className="app-shell">
    <header>
      <div><p className="eyebrow">LOCAL REACT PROTOTYPE · GENERATED CONTINENT</p><h1>Frontier</h1><p className="subtitle">Every cell is land. Every city is a decision.</p></div>
      <div className="scoreboard"><div><span>{demoMode ? "Blue AI" : "You"}</span><strong>{scores.human}</strong></div><div><span>Red AI</span><strong>{scores.bot}</strong></div><div><span>Population</span><strong>{scores.population.toLocaleString()}</strong></div><div><span>Time</span><strong>{String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</strong></div></div>
    </header>
    <section className="game-layout">
      <div className="map-panel">
        <div className="population-bar"><div><p className="eyebrow">POPULATION</p><strong>{scores.population.toLocaleString()}</strong><span>Unlimited citizens across your territories.</span></div><div className="trade-budget"><p className="eyebrow">TRADE CREDITS</p><strong>{scores.credits}</strong><span>Earn +2 per active route delivery.</span></div></div>
        <GameMap game={game} selected={selected} onTerritoryClick={handleTerritory} onTerritoryContextMenu={(territory, x, y) => { if (game.territories[territory].owner === "human") setContextMenu({ territory, x, y }); else setHint("You can manage population only in a blue territory."); }} />
        {contextMenu && <div className="province-menu" style={{ left: contextMenu.x, top: contextMenu.y }}><button onClick={() => manageTerritory(contextMenu.territory)}>Manage population · {getTerritory(game.map, contextMenu.territory).label}</button><button onClick={() => setContextMenu(null)}>Close</button></div>}
        <p className="hint">{game.winner ? (game.winner === "human" ? "Blue controls the frontier." : game.winner === "bot" ? "Red controls the frontier." : "Draw. The frontier remains contested.") : hint}</p>
      </div>
      <aside className="control-panel">
        {managedTerritory && <div className="skill-panel"><div className="skill-heading"><div><p className="eyebrow">MANAGE POPULATION</p><h2>{getTerritory(game.map, managedTerritory).label}</h2></div><button onClick={() => setManagedTerritory(null)} aria-label="Close population management">×</button></div><p>{game.territories[managedTerritory].population} citizens · {game.tradeCredits.human} credits</p><div className="skill-tree">{(["housing", "industry", "militia"] as PopulationUpgrade[]).map((upgrade, index) => { const level = game.territories[managedTerritory].upgrades[upgrade] ?? 0; const prerequisite = index === 1 ? (game.territories[managedTerritory].upgrades.housing ?? 0) >= 1 : index === 2 ? (game.territories[managedTerritory].upgrades.industry ?? 0) >= 1 : true; return <div className="skill-node" key={upgrade}><span className="skill-step">{index + 1}</span><div><strong>{UPGRADE_NAMES[upgrade]} · {level}/3</strong><small>{upgrade === "housing" ? "+1 population per level" : upgrade === "industry" ? "+1 unit per level" : "Level 2 restores fortifications"}</small></div><button disabled={level >= 3 || !prerequisite || game.tradeCredits.human < upgradeCost(level) || game.territories[managedTerritory].owner !== "human"} onClick={() => submit({ type: "upgrade", player: "human", territory: managedTerritory, upgrade })}>{level >= 3 ? "Max" : `${upgradeCost(level)} cr`}</button></div>; })}</div><small>Unlock each branch from top to bottom. Improvements belong to this province.</small></div>}
        <div className="construction-menu"><p className="eyebrow">TRADE & DEVELOPMENT</p><p className="description">Trade routes fund permanent infrastructure. Click a project, then choose a friendly territory.</p>{buildingCards.map((card) => <button key={card.building} className={buildingToPlace === card.building ? "building-card active" : "building-card"} disabled={scores.credits < BUILDING_COSTS[card.building]} onClick={() => beginConstruction(card.building)}><b>{card.icon}</b><span><strong>{BUILDING_NAMES[card.building]} · {BUILDING_COSTS[card.building]} credits</strong><small>{card.description}</small></span></button>)}</div>
        <div><p className="eyebrow">COMMAND</p><div className="actions">{(["expand", "fortify", "supply", "trade"] as ActionMode[]).map((action, index) => <button key={action} className={mode === action && !buildingToPlace ? "active" : ""} onClick={() => activateMode(action)}><span>{action}</span><kbd>{index + 1}</kbd></button>)}</div><p className="description">{descriptions[mode]}</p>{mode === "expand" && selected && <div className="force-control"><div><p className="eyebrow">ATTACK FORCE</p><strong>{committedUnits} units</strong><span>{selectedUnits - committedUnits} remain defending {getTerritory(game.map, selected).label}.</span></div><input aria-label="Attack force" type="range" min="1" max={maxAttackUnits} value={committedUnits} onChange={(event) => setAttackUnits(Number(event.target.value))} /><div className="force-presets"><button type="button" onClick={() => setAttackUnits(1)}>1</button><button type="button" onClick={() => setAttackUnits(Math.max(1, Math.floor(maxAttackUnits / 2)))}>Half</button><button type="button" onClick={() => setAttackUnits(maxAttackUnits)}>Max</button></div></div>}</div>
        <label>Bot difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as BotDifficulty)}><option value="easy">Easy</option><option value="normal">Normal</option><option value="expert">Expert</option></select></label>
        <label className="demo-toggle"><input type="checkbox" checked={demoMode} onChange={(event) => { setDemoMode(event.target.checked); setSelected(null); setBuildingToPlace(null); setHint(event.target.checked ? "Demo enabled. Blue and red commanders are fighting." : "Demo disabled. Blue is under your command."); }} />Auto-play blue (demo)</label>
        <div className="controls"><button onClick={() => setPaused(!paused)}>{paused ? "Resume" : "Pause"}</button><button className="primary" onClick={() => setScreen("setup")}>Create match</button></div>
        <div className="log"><p className="eyebrow">BATTLE LOG</p>{game.events.map((event, index) => <p key={`${event.tick}-${index}`}><span>{event.tick}s</span>{event.message}</p>)}</div>
      </aside>
    </section>
  </main>;
}
