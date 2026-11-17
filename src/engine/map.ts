import { Delaunay } from "d3-delaunay";
import type { MapDefinition, PlayerId, TerritoryDefinition, TerritoryId } from "./types";
import { getBotIds } from "./players";
import { generateMap, type MapPreset } from "./mapGenerator";
import { GENERATED_MAP_PRESETS } from "./mapPresets";
export { generateMap } from "./mapGenerator";
export type { MapGenerationConfig } from "./mapGenerator";

const MAP_WIDTH = 900;
const MAP_HEIGHT = 600;
const TERRITORY_COUNT = 32;
const ISLAND_COUNT = 18;
const MINIMUM_DISTANCE = 63;

const coastline: Array<[number, number]> = [[105,360],[79,332],[93,299],[87,267],[121,238],[123,207],[155,194],[171,158],[207,151],[230,120],[267,133],[294,108],[332,122],[356,99],[398,116],[430,145],[471,139],[501,109],[535,114],[563,91],[601,105],[632,131],[672,127],[695,157],[731,165],[748,200],[786,214],[803,246],[783,275],[817,307],[795,341],[802,374],[770,393],[758,430],[726,444],[697,477],[654,469],[624,501],[579,490],[547,516],[500,500],[462,514],[426,489],[390,498],[357,473],[318,487],[279,465],[245,477],[211,449],[177,458],[149,424],[118,412],[128,382]];
type Point = [number, number];

const regionNames = ["Aster", "Bramble", "Cinder", "Dawnreach", "Ember", "Fallow", "Gale", "Hollow", "Ironwood", "Juniper", "Kestrel", "Larkspur", "Morrow", "Northwatch", "Oaken", "Palisade", "Quartz", "Rookery", "Sable", "Thorn", "Umber", "Vale", "Westmere", "Yarrow", "Zephyr", "Alder", "Bracken", "Crownfall", "Drift", "Ebon", "Flint", "Glimmer"];
const islandNames = ["Skerry", "Haven", "Beacon", "Tide", "Shoal", "Cove", "Reef", "Marsh", "Gull", "Storm", "Coral", "Anchor", "Mist", "Pearl", "Drake", "Foam", "Ember", "North"];

function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pointKey([x, y]: Point): string {
  return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
}

function noise(key: string): number {
  let hash = 2_166_136_261;
  for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619);
  return ((hash >>> 0) % 10_000) / 10_000;
}

function roughEdge(start: Point, end: Point, roughness: number): Point[] {
  const forward = pointKey(start) < pointKey(end);
  const [first, last] = forward ? [start, end] : [end, start];
  const distance = Math.hypot(last[0] - first[0], last[1] - first[1]);
  const segments = Math.max(2, Math.ceil(distance / 28));
  const normal: Point = [-(last[1] - first[1]) / distance, (last[0] - first[0]) / distance];
  const edgeKey = `${pointKey(first)}:${pointKey(last)}`;
  const points: Point[] = [];
  for (let index = 1; index <= segments; index += 1) {
    const progress = index / segments;
    const amplitude = index === segments ? 0 : (noise(`${edgeKey}:${index}`) - 0.5) * roughness * 2;
    points.push([first[0] + (last[0] - first[0]) * progress + normal[0] * amplitude, first[1] + (last[1] - first[1]) * progress + normal[1] * amplitude]);
  }
  return forward ? points : points.reverse();
}

function roughPath(vertices: Point[], roughness: number): string {
  const normalized = vertices.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as Point);
  const closed = pointKey(normalized[0]) === pointKey(normalized.at(-1)!) ? normalized.slice(0, -1) : normalized;
  const path = [`M${closed[0][0]},${closed[0][1]}`];
  for (let index = 0; index < closed.length; index += 1) {
    for (const [x, y] of roughEdge(closed[index], closed[(index + 1) % closed.length], roughness)) path.push(`L${x},${y}`);
  }
  return `${path.join(" ")} Z`;
}

export const LAND_PATH = roughPath(coastline, 10);

export const MAP_PRESETS: readonly MapPreset[] = [
  { id: "crownlands", name: "Crownlands", seed: 27, description: "A broad central continent" },
  { id: "shattered-coast", name: "Shattered Coast", seed: 81, description: "Jagged western bays" },
  { id: "highlands", name: "Highlands", seed: 142, description: "A tall northern landmass" },
  { id: "southern-reach", name: "Southern Reach", seed: 306, description: "Wide southern frontier" },
  { id: "crescent", name: "Crescent", seed: 519, description: "A narrow curved continent" },
  ...GENERATED_MAP_PRESETS,
] as const;

export function getMapPreset(id: string) { return MAP_PRESETS.find((preset) => preset.id === id) ?? MAP_PRESETS[0]; }

function coastlineFor(presetId: string): Point[] {
  if (presetId === "crownlands") return coastline;
  const profile = MAP_PRESETS.findIndex((preset) => preset.id === presetId);
  return coastline.map(([x, y], index) => {
    const angle = (index / coastline.length) * Math.PI * 2;
    const wave = Math.sin(angle * (profile + 2) + profile) * (10 + profile * 4);
    const horizontal = presetId === "crescent" ? Math.sin((y - 300) / 160) * 40 : wave;
    const vertical = presetId === "highlands" ? (y - 300) * .12 + wave : presetId === "southern-reach" ? 25 + wave : wave * .7;
    return [Math.max(60, Math.min(840, x + horizontal)), Math.max(65, Math.min(535, y + vertical))];
  });
}

function isOnLand(x: number, y: number, coast: Point[]): boolean {
  let contained = false;
  for (let index = 0, previous = coast.length - 1; index < coast.length; previous = index++) {
    const [currentX, currentY] = coast[index];
    const [previousX, previousY] = coast[previous];
    const intersects = currentY > y !== previousY > y && x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
    if (intersects) contained = !contained;
  }
  return contained;
}

function placePoints(seed: number, coast: Point[]): Array<[number, number]> {
  const next = random(seed);
  const points: Array<[number, number]> = [];
  let attempts = 0;
  while (points.length < TERRITORY_COUNT && attempts < 20_000) {
    attempts += 1;
    const point: [number, number] = [75 + next() * 750, 95 + next() * 410];
    if (!isOnLand(point[0], point[1], coast)) continue;
    if (points.every(([x, y]) => Math.hypot(x - point[0], y - point[1]) >= MINIMUM_DISTANCE)) points.push(point);
  }
  if (points.length < TERRITORY_COUNT) throw new Error("Could not generate enough land regions.");
  return points;
}

function distanceToCoast(x: number, y: number, coast: Point[]): number {
  let closest = Infinity;
  for (let index = 0; index < coast.length; index += 1) {
    const [ax, ay] = coast[index];
    const [bx, by] = coast[(index + 1) % coast.length];
    const lengthSquared = (bx - ax) ** 2 + (by - ay) ** 2;
    const progress = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / lengthSquared));
    closest = Math.min(closest, Math.hypot(x - ax - progress * (bx - ax), y - ay - progress * (by - ay)));
  }
  return closest;
}

function placeIslands(seed: number, coast: Point[]): Array<{ x: number; y: number; path: string }> {
  const next = random(seed ^ 0x51a7d);
  const islands: Array<{ x: number; y: number; radius: number; path: string }> = [];
  for (let attempt = 0; islands.length < ISLAND_COUNT && attempt < 30_000; attempt += 1) {
    const radius = 21 + next() * 7;
    const x = 34 + next() * (MAP_WIDTH - 68);
    const y = 34 + next() * (MAP_HEIGHT - 68);
    if (isOnLand(x, y, coast) || x < radius + 7 || x > MAP_WIDTH - radius - 7 || y < radius + 7 || y > MAP_HEIGHT - radius - 7) continue;
    if (distanceToCoast(x, y, coast) < radius + 13) continue;
    if (islands.some((island) => Math.hypot(island.x - x, island.y - y) < island.radius + radius + 12)) continue;
    const corners = 9;
    const vertices: Point[] = Array.from({ length: corners }, (_, index) => {
      const angle = (index / corners) * Math.PI * 2;
      const reach = radius * (0.82 + next() * 0.25);
      return [x + Math.cos(angle) * reach, y + Math.sin(angle) * reach];
    });
    islands.push({ x, y, radius, path: roughPath(vertices, 3) });
  }
  if (islands.length < ISLAND_COUNT) throw new Error("Could not generate enough islands.");
  return islands;
}

function chooseCapitals(points: Point[], botCount: number): Map<number, PlayerId> {
  const human = points.reduce((best, point, index) => point[0] < points[best][0] ? index : best, 0);
  const red = points.reduce((best, point, index) => point[0] > points[best][0] ? index : best, 0);
  const capitals = new Map<number, PlayerId>([[human, "human"], [red, "bot"]]);
  for (const player of getBotIds(botCount).slice(1)) {
    const next = points.reduce((best, point, index) => {
      if (capitals.has(index)) return best;
      const spacing = Math.min(...[...capitals.keys()].map((capital) => Math.hypot(point[0] - points[capital][0], point[1] - points[capital][1])));
      if (best < 0) return index;
      const bestSpacing = Math.min(...[...capitals.keys()].map((capital) => Math.hypot(points[best][0] - points[capital][0], points[best][1] - points[capital][1])));
      return spacing > bestSpacing ? index : best;
    }, -1);
    capitals.set(next, player);
  }
  return capitals;
}

export function generateFrontierMap(seed = 27, presetId = "crownlands", botCount = 1): MapDefinition {
  const preset = getMapPreset(presetId);
  if (preset.generation) return generateMap(preset.generation, seed, botCount, preset.id);
  const coast = coastlineFor(presetId);
  const points = placePoints(seed, coast);
  const islands = placeIslands(seed, coast);
  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi([45, 55, MAP_WIDTH - 45, MAP_HEIGHT - 55]);
  const capitals = chooseCapitals(points, botCount);
  const territories: TerritoryDefinition[] = points.map(([x, y], index) => ({
    id: `region-${index + 1}`,
    label: regionNames[index] ?? `Region ${index + 1}`,
    x,
    y,
    // Province borders are intentionally more angular than the coastline.
    // The edge key keeps both sides of a shared border exactly identical.
    path: roughPath(Array.from(voronoi.cellPolygon(index) ?? []) as Point[], 11),
    neighbours: Array.from(delaunay.neighbors(index)).map((neighbour) => `region-${neighbour + 1}`),
    seaNeighbours: [],
    capitalFor: capitals.get(index),
  }));
  const islandTerritories: TerritoryDefinition[] = islands.map((island, index) => ({
    id: `island-${index + 1}`,
    label: islandNames[index] ?? `Isle ${index + 1}`,
    x: island.x,
    y: island.y,
    path: island.path,
    neighbours: [],
    seaNeighbours: [],
    island: true,
  }));
  for (const island of islandTerritories) {
    const nearestMainland = [...territories].sort((first, second) => Math.hypot(first.x - island.x, first.y - island.y) - Math.hypot(second.x - island.x, second.y - island.y)).slice(0, 2);
    for (const mainland of nearestMainland) {
      island.seaNeighbours.push(mainland.id);
      mainland.seaNeighbours.push(island.id);
    }
    const nextIsland = [...islandTerritories].filter((other) => other !== island).sort((first, second) => Math.hypot(first.x - island.x, first.y - island.y) - Math.hypot(second.x - island.x, second.y - island.y))[0];
    if (nextIsland && Math.hypot(nextIsland.x - island.x, nextIsland.y - island.y) < 155) {
      if (!island.seaNeighbours.includes(nextIsland.id)) island.seaNeighbours.push(nextIsland.id);
      if (!nextIsland.seaNeighbours.includes(island.id)) nextIsland.seaNeighbours.push(island.id);
    }
  }
  return { id: `${presetId}-${seed}`, seed, landPath: `${roughPath(coast, 10)} ${islands.map((island) => island.path).join(" ")}`, territories: [...territories, ...islandTerritories] };
}

export function getTerritory(map: MapDefinition, id: TerritoryId): TerritoryDefinition {
  const territory = map.territories.find((candidate) => candidate.id === id);
  if (!territory) throw new Error(`Unknown territory: ${id}`);
  return territory;
}

export function linkId(first: TerritoryId, second: TerritoryId): string {
  return [first, second].sort().join(":");
}
