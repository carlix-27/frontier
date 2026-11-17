import { Delaunay } from "d3-delaunay";
import { getBotIds } from "./players";
import type { MapDefinition, PlayerId, TerritoryDefinition } from "./types";

export type MapLayout = "grid" | "columns" | "rows" | "ring";
/** Counts are exact: provinces belong to countries; each small island adds one province. */
export interface MapGenerationConfig {
  landmasses: number;
  islands: number;
  provinces: number;
  layout: MapLayout;
  /** 0 = gentle coasts, 1 = jagged coasts. */
  roughness: number;
}
export interface MapPreset {
  id: string;
  name: string;
  seed: number;
  description: string;
  generation?: MapGenerationConfig;
}
type Point = [number, number];
type Land = { id: string; coast: Point[]; points: Point[]; island: boolean };
const WIDTH = 900;
const HEIGHT = 600;

function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = Math.imul(value ^ value >>> 15, value | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}
export function containsPoint(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function coastDistance(point: Point, coast: Point[]) {
  return Math.min(...coast.map((a, i) => {
    const b = coast[(i + 1) % coast.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return distance(point, [a[0] + t * dx, a[1] + t * dy]);
  }));
}
function outline(cx: number, cy: number, rx: number, ry: number, roughness: number, next: () => number): Point[] {
  const phase = next() * Math.PI * 2;
  const count = Math.max(16, Math.round((rx + ry) / 5));
  return Array.from({ length: count }, (_, i) => {
    const angle = i / count * Math.PI * 2;
    const radius = .83 + Math.sin(angle * 3 + phase) * .08 + Math.sin(angle * 5 - phase) * .04 + (next() - .5) * .15 * roughness;
    return [cx + Math.cos(angle) * rx * radius, cy + Math.sin(angle) * ry * radius];
  });
}
const path = (polygon: Point[]) => `M${polygon.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" L")} Z`;

/** Clip a coast against a convex Voronoi cell, so province paint never spans the sea. */
function clip(coast: Point[], cell: Point[]): Point[] {
  let result = coast;
  const area = cell.reduce((sum, a, i) => { const b = cell[(i + 1) % cell.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
  for (let i = 0; i < cell.length - 1; i++) {
    const a = cell[i], b = cell[i + 1];
    const side = (p: Point) => ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * Math.sign(area);
    const input = result; result = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length];
      const dp = side(p), dq = side(q);
      if (dp >= -1e-8) result.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return result;
}

function validate(config: MapGenerationConfig, seed: number, botCount: number) {
  const integer = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
  if (!integer(config.landmasses, 1, 12) || !integer(config.islands, 0, 30)
    || !integer(config.provinces, Math.max(config.landmasses * 2, getBotIds(botCount).length + 1), 96)
    || !Number.isFinite(seed) || !Number.isFinite(config.roughness) || config.roughness < 0 || config.roughness > 1
    || !["grid", "rows", "columns", "ring"].includes(config.layout)) throw new Error("Invalid map configuration: use 1–12 countries, 0–30 islands, 2+ provinces per country (up to 96), and roughness 0–1.");
}

export function generateMap(config: MapGenerationConfig, seed: number, botCount = 1, id = "custom"): MapDefinition {
  validate(config, seed, botCount);
  const next = random(seed);
  const lands: Land[] = [];
  const columns = config.layout === "columns" ? config.landmasses : config.layout === "rows" ? 1 : Math.round(Math.sqrt(config.landmasses * 1.5));
  const rows = Math.ceil(config.landmasses / columns);
  for (let i = 0; i < config.landmasses; i++) {
    const cellWidth = 760 / columns, cellHeight = 460 / rows;
    let cx = 70 + cellWidth * (i % columns + .5), cy = 70 + cellHeight * (Math.floor(i / columns) + .5);
    let rx = cellWidth * .43, ry = cellHeight * .43;
    if (config.layout === "ring" && config.landmasses > 1) {
      const angle = i / config.landmasses * Math.PI * 2;
      cx = 450 + Math.cos(angle) * 270; cy = 300 + Math.sin(angle) * 180;
      const spacing = Math.sin(Math.PI / config.landmasses);
      rx = Math.min(125, 220 * spacing); ry = Math.min(115, 145 * spacing);
    }
    // Separate bounding boxes leave permanent water channels between countries.
    const coast = outline(cx, cy, rx, ry, config.roughness, next);
    const count = Math.floor(config.provinces / config.landmasses) + (i < config.provinces % config.landmasses ? 1 : 0);
    const points: Point[] = [];
    // Best-candidate sampling keeps towns inland and spread out without retry failure.
    const candidates: Point[] = [];
    for (let attempt = 0; attempt < 5000; attempt++) {
      const p: Point = [cx + (next() * 2 - 1) * rx, cy + (next() * 2 - 1) * ry];
      if (containsPoint(p, coast) && coastDistance(p, coast) >= Math.min(17, rx * .2, ry * .2)) candidates.push(p);
    }
    while (points.length < count) {
      let best = -1, score = -1;
      candidates.forEach((p, j) => {
        const spacing = points.length ? Math.min(...points.map(q => distance(p, q))) : coastDistance(p, coast);
        if (spacing > score) { best = j; score = spacing; }
      });
      if (best < 0) throw new Error("Map is too dense: reduce provinces or countries.");
      points.push(candidates.splice(best, 1)[0]);
    }
    lands.push({ id: `country-${i + 1}`, coast, points, island: false });
  }
  for (let i = 0; i < config.islands; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 20000; attempt++) {
      const p: Point = [30 + next() * 840, 30 + next() * 540];
      const radius = 18 + next() * 6;
      if (lands.some(land => containsPoint(p, land.coast) || coastDistance(p, land.coast) < radius + 12)) continue;
      lands.push({ id: `island-${i + 1}`, coast: outline(p[0], p[1], radius, radius, config.roughness, next), points: [p], island: true });
      placed = true; break;
    }
    if (!placed) throw new Error("Not enough open sea for these islands. Reduce the island count.");
  }
  const groups = lands.map(land => {
    const delaunay = Delaunay.from(land.points);
    const voronoi = delaunay.voronoi([0, 0, WIDTH, HEIGHT]);
    const polygons = land.points.map((_, index) => land.island ? land.coast : clip(land.coast, Array.from(voronoi.cellPolygon(index)!) as Point[]));
    const borderKeys = polygons.map(polygon => new Set(polygon.map((point, i) => {
      const other = polygon[(i + 1) % polygon.length];
      const key = ([x, y]: Point) => `${x.toFixed(3)},${y.toFixed(3)}`;
      return [key(point), key(other)].sort().join(":");
    })));
    return land.points.map(([x, y], index): TerritoryDefinition => ({
      id: `${land.id}-province-${index + 1}`, label: land.island ? `Isle ${lands.indexOf(land) - config.landmasses + 1}` : `${["Ash", "Birch", "Cedar", "Dawn", "Elm", "Frost", "Glen", "Harbor", "Ivory", "Jade", "Kings", "Laurel"][lands.indexOf(land)]} ${index + 1}`,
      x, y, path: path(polygons[index]),
      // Delaunay candidates whose shared border was cut away by a bay are not land neighbours.
      neighbours: land.island ? [] : Array.from(delaunay.neighbors(index)).filter(j => [...borderKeys[index]].some(key => borderKeys[j].has(key))).map(j => `${land.id}-province-${j + 1}`),
      seaNeighbours: [], island: land.island, landmassId: land.id,
    }));
  });
  // A minimum spanning network guarantees every country/island is reachable.
  // Extra nearest links provide alternatives to a single naval choke point.
  const edges: { a: number; b: number; from: TerritoryDefinition; to: TerritoryDefinition; length: number }[] = [];
  for (let a = 0; a < groups.length; a++) for (let b = a + 1; b < groups.length; b++) {
    let pair: typeof edges[number] | undefined;
    for (const from of groups[a]) for (const to of groups[b]) {
      const length = Math.hypot(from.x - to.x, from.y - to.y);
      if (!pair || length < pair.length) pair = { a, b, from, to, length };
    }
    edges.push(pair!);
  }
  edges.sort((a, b) => a.length - b.length);
  const parents = groups.map((_, i) => i);
  const root = (i: number): number => parents[i] === i ? i : root(parents[i]);
  const connect = ({ from, to }: typeof edges[number]) => {
    if (!from.seaNeighbours.includes(to.id)) from.seaNeighbours.push(to.id);
    if (!to.seaNeighbours.includes(from.id)) to.seaNeighbours.push(from.id);
  };
  for (const edge of edges) if (root(edge.a) !== root(edge.b)) { connect(edge); parents[root(edge.a)] = root(edge.b); }
  groups.forEach((_, i) => edges.filter(edge => edge.a === i || edge.b === i).slice(0, 2).forEach(connect));
  const territories = groups.flat();
  const candidates = territories.filter(t => !t.island);
  const chosen: TerritoryDefinition[] = [];
  for (const player of ["human", ...getBotIds(botCount)] as PlayerId[]) {
    const available = candidates.filter(t => !t.capitalFor);
    available.sort((a, b) => {
      if (!chosen.length) return a.x - b.x;
      const score = (t: TerritoryDefinition) => Math.min(...chosen.map(c => Math.hypot(c.x - t.x, c.y - t.y))) + (chosen.some(c => c.landmassId === t.landmassId) ? 0 : 1000);
      return score(b) - score(a);
    });
    available[0].capitalFor = player; chosen.push(available[0]);
  }
  return { id: `${id}-${seed}`, seed, landPath: lands.map(land => path(land.coast)).join(" "), landmassCount: config.landmasses, territories };
}
