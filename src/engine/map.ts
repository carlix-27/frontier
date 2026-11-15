import { Delaunay } from "d3-delaunay";
import type { MapDefinition, PlayerId, TerritoryDefinition, TerritoryId } from "./types";

const MAP_WIDTH = 900;
const MAP_HEIGHT = 600;
const TERRITORY_COUNT = 32;
const MINIMUM_DISTANCE = 63;

const coastline: Array<[number, number]> = [[105,360],[79,332],[93,299],[87,267],[121,238],[123,207],[155,194],[171,158],[207,151],[230,120],[267,133],[294,108],[332,122],[356,99],[398,116],[430,145],[471,139],[501,109],[535,114],[563,91],[601,105],[632,131],[672,127],[695,157],[731,165],[748,200],[786,214],[803,246],[783,275],[817,307],[795,341],[802,374],[770,393],[758,430],[726,444],[697,477],[654,469],[624,501],[579,490],[547,516],[500,500],[462,514],[426,489],[390,498],[357,473],[318,487],[279,465],[245,477],[211,449],[177,458],[149,424],[118,412],[128,382]];
export const LAND_PATH = `${coastline.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ")} Z`;

const regionNames = ["Aster", "Bramble", "Cinder", "Dawnreach", "Ember", "Fallow", "Gale", "Hollow", "Ironwood", "Juniper", "Kestrel", "Larkspur", "Morrow", "Northwatch", "Oaken", "Palisade", "Quartz", "Rookery", "Sable", "Thorn", "Umber", "Vale", "Westmere", "Yarrow", "Zephyr", "Alder", "Bracken", "Crownfall", "Drift", "Ebon", "Flint", "Glimmer"];

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

function isOnLand(x: number, y: number): boolean {
  let contained = false;
  for (let index = 0, previous = coastline.length - 1; index < coastline.length; previous = index++) {
    const [currentX, currentY] = coastline[index];
    const [previousX, previousY] = coastline[previous];
    const intersects = currentY > y !== previousY > y && x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
    if (intersects) contained = !contained;
  }
  return contained;
}

function placePoints(seed: number): Array<[number, number]> {
  const next = random(seed);
  const points: Array<[number, number]> = [];
  let attempts = 0;
  while (points.length < TERRITORY_COUNT && attempts < 20_000) {
    attempts += 1;
    const point: [number, number] = [75 + next() * 750, 95 + next() * 410];
    if (!isOnLand(point[0], point[1])) continue;
    if (points.every(([x, y]) => Math.hypot(x - point[0], y - point[1]) >= MINIMUM_DISTANCE)) points.push(point);
  }
  if (points.length < TERRITORY_COUNT) throw new Error("Could not generate enough land regions.");
  return points;
}

function findCapitalIndex(points: Array<[number, number]>, player: PlayerId): number {
  return points.reduce((best, point, index) => player === "human" ? (point[0] < points[best][0] ? index : best) : (point[0] > points[best][0] ? index : best), 0);
}

export function generateFrontierMap(seed = 27): MapDefinition {
  const points = placePoints(seed);
  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi([45, 55, MAP_WIDTH - 45, MAP_HEIGHT - 55]);
  const humanCapital = findCapitalIndex(points, "human");
  const botCapital = findCapitalIndex(points, "bot");
  const territories: TerritoryDefinition[] = points.map(([x, y], index) => ({
    id: `region-${index + 1}`,
    label: regionNames[index] ?? `Region ${index + 1}`,
    x,
    y,
    path: voronoi.renderCell(index),
    neighbours: Array.from(delaunay.neighbors(index)).map((neighbour) => `region-${neighbour + 1}`),
    capitalFor: index === humanCapital ? "human" : index === botCapital ? "bot" : undefined,
  }));
  return { id: `frontier-${seed}`, seed, landPath: LAND_PATH, territories };
}

export function getTerritory(map: MapDefinition, id: TerritoryId): TerritoryDefinition {
  const territory = map.territories.find((candidate) => candidate.id === id);
  if (!territory) throw new Error(`Unknown territory: ${id}`);
  return territory;
}

export function linkId(first: TerritoryId, second: TerritoryId): string {
  return [first, second].sort().join(":");
}
