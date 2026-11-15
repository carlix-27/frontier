import { useEffect, useMemo, useState } from "react";
import { chooseBotCommand, type BotDifficulty } from "./bots/basicBot";
import { GameMap } from "./components/GameMap";
import { advanceGame, applyCommand, BUILDING_COSTS, BUILDING_NAMES, createInitialGame, getControlScore, getPopulation } from "./engine/game";
import { getTerritory } from "./engine/map";
import type { BuildingType, GameCommand, PlayerId, TerritoryId } from "./engine/types";

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

export default function App() {
  const [game, setGame] = useState(() => createInitialGame());
  const [mode, setMode] = useState<ActionMode>("expand");
  const [selected, setSelected] = useState<TerritoryId | null>(null);
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
    setMode(action); setSelected(null); setBuildingToPlace(null);
    setHint(action === "fortify" ? "Select a friendly region to fortify." : action === "trade" ? "Select a friendly departure port." : "Select a friendly region to begin.");
  }

  useEffect(() => {
    const timer = window.setInterval(() => setGame((current) => {
      if (paused || current.winner) return current;
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
  }, [demoMode, difficulty, paused]);

  useEffect(() => {
    const shortcuts: Record<string, ActionMode> = { "1": "expand", "2": "fortify", "3": "supply", "4": "trade" };
    function handleShortcut(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) return;
      if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
      const action = shortcuts[event.key];
      if (!action) return;
      event.preventDefault(); activateMode(action);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function submit(command: GameCommand) {
    const result = applyCommand(game, command);
    if (!result.ok) { setHint(result.reason); return false; }
    setGame(result.state); setSelected(null); return true;
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
      setSelected(id); setHint(`Selected ${getTerritory(game.map, id).label}. ${mode === "trade" ? "Choose another friendly port." : "Choose a neighbouring region."}`); return;
    }
    if (mode === "expand") submit({ type: "expand", player: "human", from: selected, to: id });
    else if (mode === "supply") submit({ type: "supply", player: "human", from: selected, to: id });
    else submit({ type: "trade", player: "human", from: selected, to: id });
  }

  function newMatch() {
    setGame(createInitialGame(300, Math.floor(Math.random() * 100_000))); setSelected(null); setBuildingToPlace(null); setPaused(false);
    setHint(demoMode ? "New continent generated. Blue and red commanders are fighting." : "New continent generated. Select a friendly region to begin.");
  }

  const remaining = Math.max(0, game.maxTicks - game.tick);
  return <main className="app-shell">
    <header>
      <div><p className="eyebrow">LOCAL REACT PROTOTYPE · GENERATED CONTINENT</p><h1>Frontier</h1><p className="subtitle">Every cell is land. Every city is a decision.</p></div>
      <div className="scoreboard"><div><span>{demoMode ? "Blue AI" : "You"}</span><strong>{scores.human}</strong></div><div><span>Red AI</span><strong>{scores.bot}</strong></div><div><span>Population</span><strong>{scores.population.toLocaleString()}</strong></div><div><span>Time</span><strong>{String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</strong></div></div>
    </header>
    <section className="game-layout">
      <div className="map-panel">
        <div className="population-bar"><div><p className="eyebrow">POPULATION</p><strong>{scores.population.toLocaleString()}</strong><span>Unlimited citizens across your territories.</span></div><div className="trade-budget"><p className="eyebrow">TRADE CREDITS</p><strong>{scores.credits}</strong><span>Earn +2 per active route delivery.</span></div></div>
        <GameMap game={game} selected={selected} onTerritoryClick={handleTerritory} />
        <p className="hint">{game.winner ? (game.winner === "human" ? "Blue controls the frontier." : game.winner === "bot" ? "Red controls the frontier." : "Draw. The frontier remains contested.") : hint}</p>
      </div>
      <aside className="control-panel">
        <div className="construction-menu"><p className="eyebrow">TRADE & DEVELOPMENT</p><p className="description">Trade routes fund permanent infrastructure. Click a project, then choose a friendly territory.</p>{buildingCards.map((card) => <button key={card.building} className={buildingToPlace === card.building ? "building-card active" : "building-card"} disabled={scores.credits < BUILDING_COSTS[card.building]} onClick={() => beginConstruction(card.building)}><b>{card.icon}</b><span><strong>{BUILDING_NAMES[card.building]} · {BUILDING_COSTS[card.building]} credits</strong><small>{card.description}</small></span></button>)}</div>
        <div><p className="eyebrow">COMMAND</p><div className="actions">{(["expand", "fortify", "supply", "trade"] as ActionMode[]).map((action, index) => <button key={action} className={mode === action && !buildingToPlace ? "active" : ""} onClick={() => activateMode(action)}><span>{action}</span><kbd>{index + 1}</kbd></button>)}</div><p className="description">{descriptions[mode]}</p></div>
        <label>Bot difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as BotDifficulty)}><option value="easy">Easy</option><option value="normal">Normal</option><option value="expert">Expert</option></select></label>
        <label className="demo-toggle"><input type="checkbox" checked={demoMode} onChange={(event) => { setDemoMode(event.target.checked); setSelected(null); setBuildingToPlace(null); setHint(event.target.checked ? "Demo enabled. Blue and red commanders are fighting." : "Demo disabled. Blue is under your command."); }} />Auto-play blue (demo)</label>
        <div className="controls"><button onClick={() => setPaused(!paused)}>{paused ? "Resume" : "Pause"}</button><button className="primary" onClick={newMatch}>New continent</button></div>
        <div className="log"><p className="eyebrow">BATTLE LOG</p>{game.events.map((event, index) => <p key={`${event.tick}-${index}`}><span>{event.tick}s</span>{event.message}</p>)}</div>
      </aside>
    </section>
  </main>;
}
