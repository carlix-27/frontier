import { AtlasPaper, AtlasSea } from "./AtlasSheet";
import { AtlasWaters } from "./AtlasWaters";
import { NavalExpedition } from "./NavalExpedition";
import { Swords } from "lucide-react";
import type { BattleReport } from "../engine/types";
import { useEffect, useId, useRef } from "react";
import { getTerritory } from "../engine/map";
import { areAllied } from "../engine/diplomacy";
import { getPlayerColor, isPlayerAlive } from "../engine/players";
import type { BuildingType, GameState, TerritoryId } from "../engine/types";
import { neutralFill, TerrainPatterns, terrainPattern } from "./TerrainPatterns";

interface Props { game: GameState; battles?: BattleReport[]; speed: 1 | 2 | 4; paused: boolean; selected: TerritoryId | null; onTerritoryClick: (id: TerritoryId) => void; onTerritoryContextMenu?: (id: TerritoryId, x: number, y: number) => void; }

function CityScene({ x, y, buildings, speed }: { x: number; y: number; buildings: BuildingType[]; speed: number }) {
  if (buildings.length === 0) return null;
  return <g className="city-scene" transform={`translate(${x - 18} ${y - 42})`}>
    {buildings.includes("housing") && <g className="city-house"><path d="M0,12 L9,4 L18,12 V23 H0 Z" /><rect x="7" y="16" width="4" height="7" /></g>}
    {buildings.includes("factory") && <g className="city-factory" transform="translate(19 4)"><path d="M0,20 V8 L6,12 L10,7 L14,12 V20 Z" /><rect x="13" y="0" width="4" height="20" /><circle cx="15" cy="-3" r="2" className="city-smoke"><animate attributeName="cy" values="-3;-12" dur={`${2 / speed}s`} repeatCount="indefinite" /><animate attributeName="opacity" values=".7;0" dur={`${2 / speed}s`} repeatCount="indefinite" /></circle></g>}
    {(buildings.includes("factory") || buildings.includes("railway")) && <g className="city-station" transform="translate(6 29)"><rect className="station-platform" x="0" y="0" width="22" height="3" rx=".5" /><rect className="station-building" x="6" y="-7" width="10" height="7" /><path className="station-roof" d="M4,-7 L11,-11 L18,-7 Z" /></g>}
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

export function GameMap({ game, battles = [], speed, paused, selected, onTerritoryClick, onTerritoryContextMenu }: Props) {
  // Newest first. Keep a single marker per province even during a counterattack.
  const fronts = new Map<string, BattleReport>();
  for (const battle of battles) if (!fronts.has(battle.territory)) fronts.set(battle.territory, battle);
  const svgRef = useRef<SVGSVGElement>(null);
  const railMaskPrefix = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const terrainPrefix = `${railMaskPrefix}-terrain`;
  const seaLanes = game.map.territories.flatMap((territory) => territory.seaNeighbours.filter((id) => id > territory.id).map((id) => ({ id: `${territory.id}:${id}`, from: territory, to: getTerritory(game.map, id) })));
  useEffect(() => { if (paused) svgRef.current?.pauseAnimations(); else svgRef.current?.unpauseAnimations(); }, [paused]);
  const moving = game.events.filter((event) => event.movement && !event.movement.bySea).slice(0, 3);
  const captures = game.events.filter((event) => event.capture).slice(0, 2);
  const rails = game.roadLinks.map((id) => {
    const [fromId, toId] = id.split(":");
    const from = getTerritory(game.map, fromId);
    const to = getTerritory(game.map, toId);
    const bend = ((from.x + to.y) % 9) - 4;
    const start = `${from.x},${from.y - 16}`;
    const end = `${to.x},${to.y - 16}`;
    const control = `${(from.x + to.x) / 2 + bend},${(from.y + to.y) / 2 - 16}`;
    return { id, fromId, toId, path: `M${start} Q${control} ${end}`, roundTrip: `M${start} Q${control} ${end} Q${control} ${start}`, supplied: game.suppliedLinks.includes(id) };
  });
  const stationIds = game.map.territories.filter((territory) => game.territories[territory.id].owner && game.territories[territory.id].buildings.some((building) => building === "factory" || building === "railway")).map((territory) => territory.id);
  const trainLinks = new Set<string>();
  for (const station of stationIds) {
    const connection = rails.find((rail) => !trainLinks.has(rail.id) && (rail.fromId === station || rail.toId === station) && game.territories[rail.fromId].owner === game.territories[rail.toId].owner);
    if (connection) trainLinks.add(connection.id);
  }
  const trains = rails.filter((rail) => trainLinks.has(rail.id)).slice(0, 8);
  const visibleTradeRoutes = game.tradeRoutes.filter((route) => {
    const recipient = game.territories[route.to].owner;
    return game.territories[route.from].owner === route.player && isPlayerAlive(game, route.player) && recipient === route.recipient && (recipient === route.player || (isPlayerAlive(game, recipient) && areAllied(game, route.player, recipient)));
  });
  return <svg ref={svgRef} className={paused ? "game-map paused" : "game-map"} viewBox="0 0 900 600" role="img" aria-label="Generated fictional continent divided into conquerable regions">
    <defs><TerrainPatterns prefix={terrainPrefix} /><clipPath id="land-clip"><path d={game.map.landPath} /></clipPath>{rails.map((rail) => <mask key={rail.id} id={`${railMaskPrefix}-${rail.id.replace(":", "-")}`} maskUnits="userSpaceOnUse" x="0" y="0" width="900" height="600"><path d={rail.path} className="rail-reveal" pathLength="100" style={{ animationDuration: `${4.8 / speed}s` }} /></mask>)}</defs>
    <AtlasSea prefix={terrainPrefix} />
    <AtlasWaters map={game.map} prefix={terrainPrefix} />
    <g className="trade-routes">{visibleTradeRoutes.map((route) => {
      const from = getTerritory(game.map, route.from); const to = getTerritory(game.map, route.to); const sea = seaRoute(from, to);
      return <g key={`${route.id}-${route.player}-${route.recipient}`}><path d={sea.path} className="trade-wake" /><g className={`trade-ship ${route.player}`}><animateMotion path={sea.roundTrip} dur={`${8 / speed}s`} repeatCount="indefinite" rotate="auto" /><path d="M-13,5 L12,5 L8,11 L-9,11 Z" className="ship-hull" /><g className="ship-cargo"><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.42;0.5;0.92;1" dur={`${8 / speed}s`} repeatCount="indefinite" /><rect x="-7" y="-4" width="5" height="8" /><rect x="-1" y="-4" width="5" height="8" /><rect x="5" y="-2" width="4" height="6" /></g><path d="M-8,4 L-8,-10 L-3,-10 L-3,4 Z" className="ship-bridge" /></g><g className="trade-unload" transform={`translate(${to.x - 10} ${to.y - 8})`}><rect width="7" height="7" /><rect x="8" width="7" height="7" /><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.4;0.46;0.54;0.6" dur={`${8 / speed}s`} repeatCount="indefinite" /></g></g>;
    })}</g>
    <g className="sea-lanes" aria-hidden="true">{seaLanes.map((lane) => <line key={lane.id} x1={lane.from.x} y1={lane.from.y} x2={lane.to.x} y2={lane.to.y} />)}</g>
    <path d={game.map.landPath} className="shallows" />
    <path d={game.map.landPath} className="land-bed" />
    <path d={game.map.landPath} className="land-outline" />
    {!game.map.landmassCount && <path className="river" d="M556,145 C535,200 570,238 531,284 C495,328 526,372 482,430" />}
    {selected && <g className="sea-attack-routes">{getTerritory(game.map, selected).seaNeighbours.map((id) => { const source = getTerritory(game.map, selected); const target = getTerritory(game.map, id); return <line key={id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} />; })}</g>}
    <g clipPath="url(#land-clip)">
      {game.map.territories.map((territory) => {
        const state = game.territories[territory.id];
        return <g key={territory.id} onClick={() => onTerritoryClick(territory.id)} onContextMenu={(event) => { event.preventDefault(); onTerritoryContextMenu?.(territory.id, event.clientX, event.clientY); }} className="territory-group">
          <path d={territory.path} className={`territory ${state.owner ?? "neutral"} ${selected === territory.id ? "selected" : ""}`} style={{ fill: state.owner ? getPlayerColor(state.owner) : neutralFill(territory, getPlayerColor(null)) }} />
          {fronts.get(territory.id)?.defender === "human" && <path d={territory.path} className="battle-pulse" pointerEvents="none" aria-hidden="true" />}
          {state.fortification > 0 && <circle cx={territory.x} cy={territory.y - 18} r="7" className="fortification" />}
          {territory.capitalFor && <circle cx={territory.x} cy={territory.y} r="25" className="capital-ring" />}
        </g>;
      })}
      <g className="terrain-layer" aria-hidden="true">{game.map.territories.map((territory) => territory.terrain && <path key={`terrain-${territory.id}`} d={territory.path} className={`terrain-overlay ${territory.terrain}`} fill={terrainPattern(terrainPrefix, territory.terrain)} />)}</g>
      <g className="rail-lines">{rails.map((rail) => <g key={rail.id} className={rail.supplied ? "rail-link supplied" : "rail-link"} mask={`url(#${railMaskPrefix}-${rail.id.replace(":", "-")})`}><path d={rail.path} className="rail-bed" /><path d={rail.path} className="rail-ties" /><path d={rail.path} className="rail-metal" /></g>)}</g>
      <g className="rail-traffic">{trains.map((train) => <g key={train.id} className="rail-train" style={{ animationDelay: `${4.8 / speed}s` }}><animateMotion path={train.roundTrip} dur={`${9 / speed}s`} repeatCount="indefinite" rotate="auto" /><rect className="train-body" x="-5" y="-3" width="10" height="6" rx="1" /><rect className="train-window" x="-3" y="-2" width="3" height="2" /><rect className="train-window" x="1" y="-2" width="2" height="2" /><circle className="train-wheel" cx="-3" cy="3" r="1" /><circle className="train-wheel" cx="3" cy="3" r="1" /></g>)}</g>
      <g className="city-layer">{game.map.territories.map((territory) => <CityScene key={`city-${territory.id}`} x={territory.x} y={territory.y} buildings={game.territories[territory.id].buildings} speed={speed} />)}</g>
    </g>
    <g clipPath="url(#land-clip)">{captures.map((event) => {
      const capture = event.capture!; const target = getTerritory(game.map, capture.territory);
      return <g key={`capture-wave-${event.tick}-${capture.territory}`}><path d={target.path} className="capture-before" style={{ fill: getPlayerColor(capture.previousOwner) }}><animate attributeName="fill-opacity" values="1;1;0" keyTimes="0;0.7;1" dur={`${1.05 / speed}s`} fill="freeze" /></path><path d={target.path} className="capture-wave" style={{ fill: getPlayerColor(capture.player) }}><animate attributeName="fill-opacity" values="0;0.18;0.9;0" keyTimes="0;0.32;0.7;1" dur={`${1.05 / speed}s`} fill="freeze" /></path><path d={target.path} className="capture-border"><animate attributeName="stroke-opacity" values="0;1;0" dur={`${1.05 / speed}s`} fill="freeze" /></path></g>;
    })}</g>
    <AtlasPaper />
    <g pointerEvents="none" aria-hidden="true">{Array.from(fronts.values(), battle => {
      const province = getTerritory(game.map, battle.territory);
      return <g key={province.id} className={`battle-marker ${battle.defender === "human" ? "incoming" : "outgoing"}`} transform={`translate(${province.x + 12} ${province.y - 22})`}>
        <circle r="8.5" /><Swords x={-6} y={-6} size={12} strokeWidth={2.3} />
      </g>;
    })}</g>
    {game.map.countries?.map((country) => <text key={country.id} x={country.x} y={country.y} className="country-name">{country.name}</text>)}
    <g className="territory-label-layer">{game.map.territories.map((territory) => {
      const state = game.territories[territory.id];
      return <g key={`label-${territory.id}`}><text x={territory.x} y={territory.y - 4} className={territory.island ? "region-name island-name" : "region-name"}>{territory.label}</text><text x={territory.x} y={territory.y + 16} className={territory.island ? "region-units island-units" : "region-units"}>{state.units}</text></g>;
    })}</g>
    <g className="naval-expeditions" pointerEvents="none">{game.invasions.map((ship, index) => {
      const from = getTerritory(game.map, ship.from);
      const to = getTerritory(game.map, ship.to);
      return <NavalExpedition key={ship.id ?? `${ship.player}-${ship.from}-${ship.to}-${ship.arrivalTick}-${index}`} ship={ship} from={from} to={to} speed={speed} tick={game.tick} />;
    })}</g>
    {moving.map((event, index) => {
      const move = event.movement!; const from = getTerritory(game.map, move.from); const to = getTerritory(game.map, move.to);
      return <g key={`${event.tick}-${index}-${move.from}-${move.to}`}><circle className={`troop ${move.player}`} style={{ fill: getPlayerColor(move.player), stroke: "#27423d" }} r="6" cx={from.x} cy={from.y}><animate attributeName="cx" from={from.x} to={to.x} dur={`${(move.byRoad ? 0.45 : 0.8) / speed}s`} fill="freeze" /><animate attributeName="cy" from={from.y} to={to.y} dur={`${(move.byRoad ? 0.45 : 0.8) / speed}s`} fill="freeze" /></circle><text className="troop-count" x={from.x} y={from.y - 12}>{move.units}</text></g>;
    })}
  </svg>;
}
