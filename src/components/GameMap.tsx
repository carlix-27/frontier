import { getTerritory } from "../engine/map";
import type { GameState, TerritoryId } from "../engine/types";

interface Props { game: GameState; selected: TerritoryId | null; onTerritoryClick: (id: TerritoryId) => void; }

function seaRoute(from: { x: number; y: number }, to: { x: number; y: number }): { path: string; roundTrip: string } {
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const distances = [midpoint.x, 900 - midpoint.x, midpoint.y, 600 - midpoint.y];
  const edge = distances.indexOf(Math.min(...distances));
  if (edge === 0 || edge === 1) {
    const seaX = edge === 0 ? 28 : 872;
    const path = `M${from.x},${from.y} C${seaX},${from.y} ${seaX},${to.y} ${to.x},${to.y}`;
    return { path, roundTrip: `${path} C${seaX},${to.y} ${seaX},${from.y} ${from.x},${from.y}` };
  }
  const seaY = edge === 2 ? 42 : 558;
  const path = `M${from.x},${from.y} C${from.x},${seaY} ${to.x},${seaY} ${to.x},${to.y}`;
  return { path, roundTrip: `${path} C${to.x},${seaY} ${from.x},${seaY} ${from.x},${from.y}` };
}

export function GameMap({ game, selected, onTerritoryClick }: Props) {
  const moving = game.events.filter((event) => event.movement).slice(0, 3);
  const captures = game.events.filter((event) => event.capture).slice(0, 2);
  return <svg className="game-map" viewBox="0 0 900 600" role="img" aria-label="Generated fictional continent divided into conquerable regions">
    <defs><clipPath id="land-clip"><path d={game.map.landPath} /></clipPath><linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#5ba9c2" /><stop offset="1" stopColor="#174c6d" /></linearGradient>{captures.map((event, index) => <clipPath id={`capture-${event.tick}-${index}`} key={`clip-${event.tick}-${index}`}><path d={getTerritory(game.map, event.capture!.territory).path} /></clipPath>)}</defs>
    <rect width="900" height="600" fill="url(#ocean)" />
    <g className="trade-routes">{game.tradeRoutes.map((route) => {
      const from = getTerritory(game.map, route.from); const to = getTerritory(game.map, route.to); const sea = seaRoute(from, to);
      return <g key={route.id}><path d={sea.path} className="trade-wake" /><g className={`trade-ship ${route.player}`}><animateMotion path={sea.roundTrip} dur="8s" repeatCount="indefinite" rotate="auto" /><path d="M-13,5 L12,5 L8,11 L-9,11 Z" className="ship-hull" /><g className="ship-cargo"><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.42;0.5;0.92;1" dur="8s" repeatCount="indefinite" /><rect x="-7" y="-4" width="5" height="8" /><rect x="-1" y="-4" width="5" height="8" /><rect x="5" y="-2" width="4" height="6" /></g><path d="M-8,4 L-8,-10 L-3,-10 L-3,4 Z" className="ship-bridge" /></g><g className="trade-unload" transform={`translate(${to.x - 10} ${to.y - 8})`}><rect width="7" height="7" /><rect x="8" width="7" height="7" /><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.4;0.46;0.54;0.6" dur="8s" repeatCount="indefinite" /></g></g>;
    })}</g>
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
          <text key={`${territory.id}-${state.population}`} x={territory.x} y={territory.y + 31} className="region-population">{state.population} pop</text>
        </g>;
      })}
      {game.suppliedLinks.map((link) => {
        const [from, to] = link.split(":"); const first = getTerritory(game.map, from); const second = getTerritory(game.map, to);
        return <line key={link} className="supply-link" x1={first.x} y1={first.y} x2={second.x} y2={second.y} />;
      })}
    </g>
    <g clipPath="url(#land-clip)">{captures.map((event, index) => {
      const capture = event.capture!; const source = getTerritory(game.map, capture.from); const target = getTerritory(game.map, capture.territory); const radius = Math.hypot(source.x - target.x, source.y - target.y) + 130;
      return <g key={`capture-wave-${event.tick}-${capture.territory}`} clipPath={`url(#capture-${event.tick}-${index})`}><path d={target.path} className={`capture-before ${capture.previousOwner ?? "neutral"}`}><animate attributeName="fill-opacity" values="1;1;0" keyTimes="0;0.78;1" dur="1.4s" fill="freeze" /></path><circle className={`capture-wave ${capture.player}`} cx={source.x} cy={source.y} r="0"><animate attributeName="r" values={`0;${radius}`} dur="1.15s" fill="freeze" /></circle><path d={target.path} className="capture-border"><animate attributeName="stroke-opacity" values="0;1;0" dur="1.15s" fill="freeze" /></path></g>;
    })}</g>
    {moving.map((event, index) => {
      const move = event.movement!; const from = getTerritory(game.map, move.from); const to = getTerritory(game.map, move.to);
      return <g key={`${event.tick}-${index}-${move.from}-${move.to}`}><circle className={`troop ${move.player}`} r="6" cx={from.x} cy={from.y}><animate attributeName="cx" from={from.x} to={to.x} dur="0.8s" fill="freeze" /><animate attributeName="cy" from={from.y} to={to.y} dur="0.8s" fill="freeze" /></circle><text className="troop-count" x={from.x} y={from.y - 12}>{move.units}</text></g>;
    })}
  </svg>;
}
