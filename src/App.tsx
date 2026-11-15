import { useEffect, useMemo, useState } from "react";
import { chooseBotCommand, type BotDifficulty } from "./bots/basicBot";
import { GameMap } from "./components/GameMap";
import { advanceGame, applyCommand, createInitialGame, getControlScore } from "./engine/game";
import { getTerritory } from "./engine/map";
import type { GameCommand, TerritoryId } from "./engine/types";

type ActionMode = "expand" | "fortify" | "supply";
const descriptions: Record<ActionMode, string> = { expand: "Move half your force across a shared frontier.", fortify: "Spend 2 units to increase a territory's defence.", supply: "Open a route between adjacent friendly territories for faster growth." };

export default function App() {
  const [game, setGame] = useState(() => createInitialGame());
  const [mode, setMode] = useState<ActionMode>("expand");
  const [selected, setSelected] = useState<TerritoryId | null>(null);
  const [difficulty, setDifficulty] = useState<BotDifficulty>("normal");
  const [paused, setPaused] = useState(false);
  const [hint, setHint] = useState("Select a friendly region to begin.");
  const scores = useMemo(() => ({ human: getControlScore(game, "human"), bot: getControlScore(game, "bot") }), [game]);

  useEffect(() => {
    const timer = window.setInterval(() => setGame((current) => {
      if (paused || current.winner) return current;
      let next = advanceGame(current);
      const cadence = difficulty === "easy" ? 5 : difficulty === "normal" ? 3 : 2;
      if (!next.winner && next.tick % cadence === 0) { const command = chooseBotCommand(next, difficulty); if (command) { const result = applyCommand(next, command); if (result.ok) next = result.state; } }
      return next;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [difficulty, paused]);

  function submit(command: GameCommand) { const result = applyCommand(game, command); if (!result.ok) { setHint(result.reason); return; } setGame(result.state); setSelected(null); setHint("Order executed. Watch the troops cross the frontier."); }
  function handleTerritory(id: TerritoryId) {
    if (game.winner) return;
    if (mode === "fortify") { submit({ type: "fortify", player: "human", territory: id }); return; }
    if (!selected) { if (game.territories[id].owner !== "human") { setHint("Choose one of your own regions as the origin."); return; } setSelected(id); setHint(`Selected ${getTerritory(game.map, id).label}. Choose a neighbouring region.`); return; }
    submit(mode === "expand" ? { type: "expand", player: "human", from: selected, to: id } : { type: "supply", player: "human", from: selected, to: id });
  }
  function newMatch() { setGame(createInitialGame(300, Math.floor(Math.random() * 100_000))); setSelected(null); setPaused(false); setHint("New continent generated. Select a friendly region to begin."); }
  const remaining = Math.max(0, game.maxTicks - game.tick);
  return <main className="app-shell"><header><div><p className="eyebrow">LOCAL REACT PROTOTYPE · GENERATED CONTINENT</p><h1>Frontier</h1><p className="subtitle">Every cell is land. Every border is a decision.</p></div><div className="scoreboard"><div><span>You</span><strong>{scores.human}</strong></div><div><span>Bot</span><strong>{scores.bot}</strong></div><div><span>Time</span><strong>{String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</strong></div></div></header><section className="game-layout"><div className="map-panel"><GameMap game={game} selected={selected} onTerritoryClick={handleTerritory} /><p className="hint">{game.winner ? (game.winner === "human" ? "Victory. The frontier is yours." : game.winner === "bot" ? "Defeat. Try a different route." : "Draw. The frontier remains contested.") : hint}</p></div><aside className="control-panel"><div><p className="eyebrow">COMMAND</p><div className="actions">{(["expand", "fortify", "supply"] as ActionMode[]).map((action) => <button key={action} className={mode === action ? "active" : ""} onClick={() => { setMode(action); setSelected(null); setHint(action === "fortify" ? "Select a friendly region to fortify." : "Select a friendly region to begin."); }}>{action}</button>)}</div><p className="description">{descriptions[mode]}</p></div><label>Bot difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as BotDifficulty)}><option value="easy">Easy</option><option value="normal">Normal</option><option value="expert">Expert</option></select></label><div className="controls"><button onClick={() => setPaused(!paused)}>{paused ? "Resume" : "Pause"}</button><button className="primary" onClick={newMatch}>New continent</button></div><div className="log"><p className="eyebrow">BATTLE LOG</p>{game.events.map((event, index) => <p key={`${event.tick}-${index}`}><span>{event.tick}s</span>{event.message}</p>)}</div></aside></section></main>;
}
