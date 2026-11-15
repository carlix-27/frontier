import { getTerritory } from "../engine/map";
import type { GameState, TerritoryId } from "../engine/types";

interface Props { game: GameState; selected: TerritoryId | null; onTerritoryClick: (id: TerritoryId) => void; }

export function GameMap({ game, selected, onTerritoryClick }: Props) {
  const moving = game.events.filter((event) => event.movement).slice(0, 3);
  return <svg className="game-map" viewBox="0 0 900 600" role="img" aria-label="Generated fictional continent divided into conquerable regions">
    <defs><clipPath id="land-clip"><path d={game.map.landPath} /></clipPath><linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#5ba9c2" /><stop offset="1" stopColor="#174c6d" /></linearGradient></defs>
    <rect width="900" height="600" fill="url(#ocean)" />
    <path d={game.map.landPath} className="land-bed" />
    <path d={game.map.landPath} className="land-outline" />
    <g className="decorative-islands"><path d="M106,150 l13,-8 18,5 7,13 -16,10 -19,-4 Z" /><path d="M755,470 l12,-6 17,7 1,14 -18,7 -13,-8 Z" /><path d="M160,480 l10,-5 12,7 -2,12 -15,2 Z" /></g>
    <path className="river" d="M556,145 C535,200 570,238 531,284 C495,328 526,372 482,430" />
    <g clipPath="url(#land-clip)">
      {game.map.territories.map((territory) => {
        const state = game.territories[territory.id];
        return <g key={territory.id} onClick={() => onTerritoryClick(territory.id)} className="territory-group">
          <path d={territory.path} className={`territory ${state.owner ?? "neutral"} ${selected === territory.id ? "selected" : ""}`} />
          {state.fortification > 0 && <circle cx={territory.x} cy={territory.y - 18} r="7" className="fortification" />}
          {territory.capitalFor && <circle cx={territory.x} cy={territory.y} r="25" className="capital-ring" />}
          <text x={territory.x} y={territory.y - 4} className="region-name">{territory.label}</text>
          <text x={territory.x} y={territory.y + 16} className="region-units">{state.units}</text>
        </g>;
      })}
      {game.suppliedLinks.map((link) => {
        const [from, to] = link.split(":"); const first = getTerritory(game.map, from); const second = getTerritory(game.map, to);
        return <line key={link} className="supply-link" x1={first.x} y1={first.y} x2={second.x} y2={second.y} />;
      })}
    </g>
    {moving.map((event, index) => {
      const move = event.movement!; const from = getTerritory(game.map, move.from); const to = getTerritory(game.map, move.to);
      return <g key={`${event.tick}-${index}-${move.from}-${move.to}`}><circle className={`troop ${move.player}`} r="6" cx={from.x} cy={from.y}><animate attributeName="cx" from={from.x} to={to.x} dur="0.8s" fill="freeze" /><animate attributeName="cy" from={from.y} to={to.y} dur="0.8s" fill="freeze" /></circle><text className="troop-count" x={from.x} y={from.y - 12}>{move.units}</text></g>;
    })}
  </svg>;
}
