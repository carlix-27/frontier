import { useEffect, useRef } from "react";
import { getTerritory, linkId } from "../engine/map";
import type { BuildingType, GameState, TerritoryId } from "../engine/types";

interface Props { game: GameState; speed: 1 | 2 | 4; paused: boolean; selected: TerritoryId | null; onTerritoryClick: (id: TerritoryId) => void; onTerritoryContextMenu?: (id: TerritoryId, x: number, y: number) => void; }

function CityScene({ x, y, buildings, speed }: { x: number; y: number; buildings: BuildingType[]; speed: number }) {
  if (buildings.length === 0) return null;
  return <g className="city-scene" transform={`translate(${x - 18} ${y - 42})`}>
    {buildings.includes("housing") && <g className="city-house"><path d="M0,12 L9,4 L18,12 V23 H0 Z" /><rect x="7" y="16" width="4" height="7" /></g>}
    {buildings.includes("factory") && <g className="city-factory" transform="translate(19 4)"><path d="M0,20 V8 L6,12 L10,7 L14,12 V20 Z" /><rect x="13" y="0" width="4" height="20" /><circle cx="15" cy="-3" r="2" className="city-smoke"><animate attributeName="cy" values="-3;-12" dur={`${2 / speed}s`} repeatCount="indefinite" /><animate attributeName="opacity" values=".7;0" dur={`${2 / speed}s`} repeatCount="indefinite" /></circle></g>}
    {buildings.includes("railway") && <g className="city-railway" transform="translate(-3 26)"><path d="M0,0 H41" /><g className="city-train"><animateTransform attributeName="transform" type="translate" values="0 0;20 0;0 0" dur={`${2.4 / speed}s`} repeatCount="indefinite" /><rect x="0" y="-5" width="11" height="5" /><circle cx="3" cy="1" r="1.4" /><circle cx="8" cy="1" r="1.4" /></g></g>}
    <g className="city-citizens"><circle cx="4" cy="27" r="1.4"><animate attributeName="cx" values="4;14;4" dur={`${2.2 / speed}s`} repeatCount="indefinite" /></circle><circle cx="17" cy="27" r="1.4"><animate attributeName="cx" values="17;28;17" dur={`${2.8 / speed}s`} repeatCount="indefinite" /></circle></g>
  </g>;
}

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

export function GameMap({ game, speed, paused, selected, onTerritoryClick, onTerritoryContextMenu }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => { if (paused) svgRef.current?.pauseAnimations(); else svgRef.current?.unpauseAnimations(); }, [paused]);
  const moving = game.events.filter((event) => event.movement).slice(0, 3);
  const captures = game.events.filter((event) => event.capture).slice(0, 2);
  const roads = game.map.territories.flatMap((territory) => territory.neighbours.filter((neighbor) => territory.id < neighbor && game.territories[territory.id].owner && game.territories[territory.id].owner === game.territories[neighbor].owner).map((neighbor) => {
    const destination = getTerritory(game.map, neighbor);
    const midpointX = (territory.x + destination.x) / 2;
    const midpointY = (territory.y + destination.y) / 2 - 24;
    const bend = ((territory.x + territory.y + destination.x) % 17) - 8;
    return { id: linkId(territory.id, neighbor), path: `M${territory.x},${territory.y - 24} Q${midpointX + bend},${midpointY + bend} ${destination.x},${destination.y - 24}`, supplied: game.suppliedLinks.includes(linkId(territory.id, neighbor)) };
  }));
  return <svg ref={svgRef} className="game-map" viewBox="0 0 900 600" role="img" aria-label="Generated fictional continent divided into conquerable regions">
    <defs><clipPath id="land-clip"><path d={game.map.landPath} /></clipPath><linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#5ba9c2" /><stop offset="1" stopColor="#174c6d" /></linearGradient></defs>
    <rect width="900" height="600" fill="url(#ocean)" />
    <g className="trade-routes">{game.tradeRoutes.map((route) => {
      const from = getTerritory(game.map, route.from); const to = getTerritory(game.map, route.to); const sea = seaRoute(from, to);
      return <g key={route.id}><path d={sea.path} className="trade-wake" /><g className={`trade-ship ${route.player}`}><animateMotion path={sea.roundTrip} dur={`${8 / speed}s`} repeatCount="indefinite" rotate="auto" /><path d="M-13,5 L12,5 L8,11 L-9,11 Z" className="ship-hull" /><g className="ship-cargo"><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.42;0.5;0.92;1" dur={`${8 / speed}s`} repeatCount="indefinite" /><rect x="-7" y="-4" width="5" height="8" /><rect x="-1" y="-4" width="5" height="8" /><rect x="5" y="-2" width="4" height="6" /></g><path d="M-8,4 L-8,-10 L-3,-10 L-3,4 Z" className="ship-bridge" /></g><g className="trade-unload" transform={`translate(${to.x - 10} ${to.y - 8})`}><rect width="7" height="7" /><rect x="8" width="7" height="7" /><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.4;0.46;0.54;0.6" dur={`${8 / speed}s`} repeatCount="indefinite" /></g></g>;
    })}</g>
    <path d={game.map.landPath} className="land-bed" />
    <path d={game.map.landPath} className="land-outline" />
    <path className="river" d="M556,145 C535,200 570,238 531,284 C495,328 526,372 482,430" />
    {selected && <g className="sea-attack-routes">{getTerritory(game.map, selected).seaNeighbours.map((id) => { const source = getTerritory(game.map, selected); const target = getTerritory(game.map, id); return <line key={id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} />; })}</g>}
    <g clipPath="url(#land-clip)">
      {game.map.territories.map((territory) => {
        const state = game.territories[territory.id];
        return <g key={territory.id} onClick={() => onTerritoryClick(territory.id)} onContextMenu={(event) => { event.preventDefault(); onTerritoryContextMenu?.(territory.id, event.clientX, event.clientY); }} className="territory-group">
          <path d={territory.path} className={`territory ${state.owner ?? "neutral"} ${selected === territory.id ? "selected" : ""}`} />
          {state.fortification > 0 && <circle cx={territory.x} cy={territory.y - 18} r="7" className="fortification" />}
          {territory.capitalFor && <circle cx={territory.x} cy={territory.y} r="25" className="capital-ring" />}
        </g>;
      })}
      <g className="dirt-roads">{roads.map((road) => <g key={road.id} className={road.supplied ? "dirt-road supplied" : "dirt-road"}><path d={road.path} className="road-bed" pathLength="100" strokeDasharray="100" strokeDashoffset="100"><animate attributeName="stroke-dashoffset" from="100" to="0" dur={`${0.7 / speed}s`} fill="freeze" /></path><path d={road.path} className="road-surface" pathLength="100" strokeDasharray="100" strokeDashoffset="100"><animate attributeName="stroke-dashoffset" from="100" to="0" dur={`${0.7 / speed}s`} fill="freeze" /></path></g>)}</g>
      <g className="city-layer">{game.map.territories.map((territory) => <CityScene key={`city-${territory.id}`} x={territory.x} y={territory.y} buildings={game.territories[territory.id].buildings} speed={speed} />)}</g>
    </g>
    <g clipPath="url(#land-clip)">{captures.map((event) => {
      const capture = event.capture!; const target = getTerritory(game.map, capture.territory);
      return <g key={`capture-wave-${event.tick}-${capture.territory}`}><path d={target.path} className={`capture-before ${capture.previousOwner ?? "neutral"}`}><animate attributeName="fill-opacity" values="1;1;0" keyTimes="0;0.7;1" dur={`${1.05 / speed}s`} fill="freeze" /></path><path d={target.path} className={`capture-wave ${capture.player}`}><animate attributeName="fill-opacity" values="0;0.18;0.9;0" keyTimes="0;0.32;0.7;1" dur={`${1.05 / speed}s`} fill="freeze" /></path><path d={target.path} className="capture-border"><animate attributeName="stroke-opacity" values="0;1;0" dur={`${1.05 / speed}s`} fill="freeze" /></path></g>;
    })}</g>
    <g clipPath="url(#land-clip)" className="territory-label-layer">{game.map.territories.map((territory) => {
      const state = game.territories[territory.id];
      return <g key={`label-${territory.id}`}><text x={territory.x} y={territory.y - 4} className={territory.island ? "region-name island-name" : "region-name"}>{territory.label}</text><text x={territory.x} y={territory.y + 16} className={territory.island ? "region-units island-units" : "region-units"}>{state.units}</text></g>;
    })}</g>
    {moving.map((event, index) => {
      const move = event.movement!; const from = getTerritory(game.map, move.from); const to = getTerritory(game.map, move.to);
      if (move.bySea) {
        const path = `M${from.x},${from.y} Q${(from.x + to.x) / 2},${(from.y + to.y) / 2 - 16} ${to.x},${to.y}`;
        return <g key={`${event.tick}-${index}-${move.from}-${move.to}`} className="invasion-ship"><path d={path} className="invasion-wake"><animate attributeName="stroke-opacity" values="0;.8;0" dur={`${0.9 / speed}s`} fill="freeze" /></path><g><animateMotion path={path} dur={`${0.9 / speed}s`} fill="freeze" rotate="auto" /><path d="M-9,2 L9,2 L6,7 L-6,7 Z" className={`invasion-hull ${move.player}`} /><rect x="-5" y="-5" width="4" height="7" /><rect x="1" y="-5" width="4" height="7" /><animate attributeName="opacity" values="1;1;0" keyTimes="0;0.82;1" dur={`${0.9 / speed}s`} fill="freeze" /></g></g>;
      }
      return <g key={`${event.tick}-${index}-${move.from}-${move.to}`}><circle className={`troop ${move.player}`} r="6" cx={from.x} cy={from.y}><animate attributeName="cx" from={from.x} to={to.x} dur={`${(move.byRoad ? 0.45 : 0.8) / speed}s`} fill="freeze" /><animate attributeName="cy" from={from.y} to={to.y} dur={`${(move.byRoad ? 0.45 : 0.8) / speed}s`} fill="freeze" /></circle><text className="troop-count" x={from.x} y={from.y - 12}>{move.units}</text></g>;
    })}
  </svg>;
}
