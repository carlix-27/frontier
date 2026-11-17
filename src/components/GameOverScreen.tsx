import { ArrowLeft, Eye, RotateCcw, Settings2, Trophy } from "lucide-react";
import { getControlScore, getPopulation } from "../engine/game";
import { getPlayerColor, getPlayerName } from "../engine/players";
import type { GameState } from "../engine/types";

interface Props {
  game: GameState;
  demoMode: boolean;
  onReplay: () => void;
  onCreate: () => void;
  onHome: () => void;
  onViewMap: () => void;
}

export function GameOverScreen({ game, demoMode, onReplay, onCreate, onHome, onViewMap }: Props) {
  const winner = game.winner;
  if (!winner) return null;

  const draw = winner === "draw";
  const winningName = draw ? "" : getPlayerName(winner);
  const title = draw ? "It's a draw" : winner === "human" && !demoMode ? "You win!" : `${winningName} AI wins!`;
  const message = draw ? "The frontier remains contested." : `${winningName} controls the frontier.`;
  const reason = game.events[0]?.message.startsWith("Time expired") ? "Time expired" : draw ? "No capitals remain" : "Last nation standing";
  const territories = draw ? 0 : Object.values(game.territories).filter((territory) => territory.owner === winner).length;
  const population = draw ? 0 : getPopulation(game, winner);
  const score = draw ? 0 : getControlScore(game, winner);

  return <div className="game-over-overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title" aria-describedby="game-over-message">
    <section className="game-over-card">
      <div className="game-over-emblem" style={{ backgroundColor: draw ? "var(--accent-soft)" : getPlayerColor(winner), color: draw ? "var(--accent)" : "#17232c" }}><Trophy size={28} strokeWidth={2.1} /></div>
      <p className="game-over-kicker">GAME OVER · {reason}</p>
      <h2 id="game-over-title">{title}</h2>
      <p id="game-over-message" className="game-over-message">{message}</p>
      <div className="game-over-stats" aria-label="Final match statistics">
        <div><span>Territories</span><strong>{draw ? "—" : territories}</strong></div>
        <div><span>Population</span><strong>{draw ? "—" : population.toLocaleString()}</strong></div>
        <div><span>Score</span><strong>{draw ? "—" : score}</strong></div>
        <div><span>Match time</span><strong>{Math.floor(game.tick / 60)}:{String(game.tick % 60).padStart(2, "0")}</strong></div>
      </div>
      <div className="game-over-actions">
        <button type="button" className="game-over-primary" autoFocus onClick={onReplay}><RotateCcw size={18} />Play again</button>
        <button type="button" onClick={onCreate}><Settings2 size={18} />Change settings</button>
        <button type="button" onClick={onViewMap}><Eye size={18} />View final map</button>
        <button type="button" onClick={onHome}><ArrowLeft size={18} />Back to home</button>
      </div>
    </section>
  </div>;
}
