import { Delaunay } from "d3-delaunay";
import type { MapDefinition, PlayerId, TerritoryDefinition, TerritoryId } from "./types";

const MAP_WIDTH = 900;
const MAP_HEIGHT = 600;
const TERRITORY_COUNT = 32;
const MINIMUM_DISTANCE = 63;

export const LAND_PATH = "M93,328 C77,230 126,139 220,122 C289,65 395,88 454,130 C548,75 675,109 722,180 C825,207 849,322 786,378 C787,465 677,524 586,488 C508,542 394,512 344,472 C243,517 136,465 144,383 C111,370 96,351 93,328 Z";

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
  const normalizedX = (x - MAP_WIDTH / 2) / 365;
  const normalizedY = (y - MAP_HEIGHT / 2) / 215;
  const coastline = 0.11 * Math.sin(x / 67) + 0.07 * Math.cos(y / 43) + 0.05 * Math.sin((x + y) / 52);
  return normalizedX ** 2 + normalizedY ** 2 < 0.94 + coastline;
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
