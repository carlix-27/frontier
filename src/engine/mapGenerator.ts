import { Delaunay } from "d3-delaunay";
import { createNameGenerator } from "./names";
import { getBotIds } from "./players";
import type { Terrain } from "./terrain";
import type { CountryDefinition, MapDefinition, MapGenerationConfig, MapLayout, PlayerId, TerritoryDefinition } from "./types";

export type { MapGenerationConfig, MapLayout } from "./types";
export const MAP_LAYOUTS: readonly MapLayout[] = ["grid", "columns", "rows", "ring", "scatter"];
export const MAP_LIMITS = { landmasses: [1, 12], islands: [0, 30], provinces: [2, 96] } as const;

export interface MapPreset {
  id: string;
  name: string;
  seed: number;
  description: string;
  generation?: MapGenerationConfig;
}
type Point = [number, number];
type Land = { id: string; coast: Point[]; points: Point[]; island: boolean; name: string; ridge?: [Point, Point] };
const WIDTH = 900;
const HEIGHT = 600;
/** Minimum open water between two coasts, so countries never touch. */
const CHANNEL = 16;

// ---------------------------------------------------------------------------
// Deterministic randomness and noise
// ---------------------------------------------------------------------------

function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = Math.imul(value ^ value >>> 15, value | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed | 0, 0x27d4eb2d);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
function valueNoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const s = (t: number) => t * t * (3 - 2 * t);
  const top = hash2(ix, iy, seed) + (hash2(ix + 1, iy, seed) - hash2(ix, iy, seed)) * s(fx);
  const bottom = hash2(ix, iy + 1, seed) + (hash2(ix + 1, iy + 1, seed) - hash2(ix, iy + 1, seed)) * s(fx);
  return top + (bottom - top) * s(fy);
}
/** Fractal noise in [0, 1). */
function fbm(x: number, y: number, seed: number, octaves = 3) {
  let amplitude = 1, frequency = 1, sum = 0, norm = 0;
  for (let octave = 0; octave < octaves; octave++) {
    sum += amplitude * valueNoise(x * frequency, y * frequency, seed + octave * 1013);
    norm += amplitude; amplitude *= .5; frequency *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function containsPoint(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function segmentDistance(point: Point, a: Point, b: Point) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared));
  return distance(point, [a[0] + t * dx, a[1] + t * dy]);
}
function coastDistance(point: Point, coast: Point[]) {
  let closest = Infinity;
  for (let i = 0; i < coast.length; i++) closest = Math.min(closest, segmentDistance(point, coast[i], coast[(i + 1) % coast.length]));
  return closest;
}
function area(polygon: Point[]) {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) { const a = polygon[i], b = polygon[(i + 1) % polygon.length]; sum += a[0] * b[1] - b[0] * a[1]; }
  return sum / 2;
}
function centroid(polygon: Point[]): Point | null {
  const signed = area(polygon);
  if (Math.abs(signed) < 1e-6) return null;
  let cx = 0, cy = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], cross = a[0] * b[1] - b[0] * a[1];
    cx += (a[0] + b[0]) * cross; cy += (a[1] + b[1]) * cross;
  }
  return [cx / (6 * signed), cy / (6 * signed)];
}
function bounds(polygon: Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of polygon) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  return { minX, minY, maxX, maxY };
}
function scaleAbout(polygon: Point[], [cx, cy]: Point, factor: number): Point[] {
  return polygon.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor]);
}
function segmentsIntersect(p1: Point, p2: Point, q1: Point, q2: Point) {
  const cross = (a: Point, b: Point, c: Point) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = cross(q1, q2, p1), d2 = cross(q1, q2, p2), d3 = cross(p1, p2, q1), d4 = cross(p1, p2, q2);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
function crossesPolygon(a: Point, b: Point, polygon: Point[]) {
  for (let i = 0; i < polygon.length; i++) if (segmentsIntersect(a, b, polygon[i], polygon[(i + 1) % polygon.length])) return true;
  return false;
}
function coastGap(first: Point[], second: Point[]) {
  let gap = Infinity;
  for (const point of first) for (const other of second) gap = Math.min(gap, distance(point, other));
  return gap;
}
const path = (polygon: Point[]) => `M${polygon.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" L")} Z`;

/**
 * A radial coastline built from periodic harmonics, a few peninsulas and bays,
 * and smoothed jitter. Radial shapes are always simple polygons, so every
 * coast is a valid, non-self-intersecting outline.
 */
function outline(cx: number, cy: number, rx: number, ry: number, roughness: number, next: () => number, rotation = 0): Point[] {
  const count = Math.max(22, Math.min(120, Math.round((rx + ry) / 3.2)));
  const harmonics = [2, 3, 4, 5, 7, 9, 13, 17, 23].map((k, i) => ({ k, amplitude: (i < 2 ? .06 : .05 / (i - .5)) * (.3 + roughness * 1.1) * (.6 + next() * .8), phase: next() * Math.PI * 2 }));
  // Peninsulas push the coast out; bays cut into it.
  const features = Array.from({ length: 1 + Math.floor(next() * (2 + roughness * 4)) }, () => ({
    at: next() * Math.PI * 2,
    width: .12 + next() * .3,
    amplitude: (next() < .55 ? 1 : -1) * (.08 + next() * .16) * (.4 + roughness * .6),
  }));
  const jitter = Array.from({ length: count }, () => (next() - .5) * .22 * roughness);
  const smooth = jitter.map((value, i) => (jitter[(i - 1 + count) % count] + value * 2 + jitter[(i + 1) % count]) / 4);
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  return Array.from({ length: count }, (_, i) => {
    const angle = i / count * Math.PI * 2;
    let radius = .86 + smooth[i] + jitter[i] * .25;
    for (const { k, amplitude, phase } of harmonics) radius += Math.sin(angle * k + phase) * amplitude;
    for (const feature of features) {
      const delta = Math.atan2(Math.sin(angle - feature.at), Math.cos(angle - feature.at));
      radius += feature.amplitude * Math.exp(-(delta * delta) / (2 * feature.width * feature.width));
    }
    radius = Math.max(.5, Math.min(1.15, radius));
    const x = Math.cos(angle) * rx * radius, y = Math.sin(angle) * ry * radius;
    return [cx + x * cos - y * sin, cy + x * sin + y * cos];
  });
}

/** Clip a coast against a convex Voronoi cell, so province paint never spans the sea. */
function clip(coast: Point[], cell: Point[]): Point[] {
  let result = coast;
  const cellArea = area(cell);
  for (let i = 0; i < cell.length - 1; i++) {
    const a = cell[i], b = cell[i + 1];
    const side = (p: Point) => ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * Math.sign(cellArea);
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

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Returns a readable problem with the configuration, or null when it can be generated. */
export function validateMapConfig(config: MapGenerationConfig, seed = 0, botCount = 1): string | null {
  const integer = (value: number, [min, max]: readonly [number, number]) => Number.isInteger(value) && value >= min && value <= max;
  if (!integer(config.landmasses, MAP_LIMITS.landmasses)) return "Use 1–12 countries.";
  if (!integer(config.islands, MAP_LIMITS.islands)) return "Use 0–30 islands.";
  const minimum = Math.max(config.landmasses * 2, getBotIds(botCount).length + 1);
  if (!Number.isInteger(config.provinces) || config.provinces > MAP_LIMITS.provinces[1]) return "Use up to 96 country provinces.";
  if (config.provinces < minimum) return `Use at least ${minimum} provinces: two per country and one per capital.`;
  if (!Number.isFinite(seed)) return "The seed must be a number.";
  if (!Number.isFinite(config.roughness) || config.roughness < 0 || config.roughness > 1) return "Coast roughness must be between 0 and 1.";
  if (!MAP_LAYOUTS.includes(config.layout)) return "Unknown layout.";
  return null;
}

// ---------------------------------------------------------------------------
// Landmass placement
// ---------------------------------------------------------------------------

type Slot = { cx: number; cy: number; rx: number; ry: number; box: { minX: number; minY: number; maxX: number; maxY: number } };

function layoutSlots(config: MapGenerationConfig, next: () => number): Slot[] {
  const count = config.landmasses;
  const slots: Slot[] = [];
  if (config.layout === "ring" && count > 1) {
    const spacing = Math.sin(Math.PI / count);
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2 + (next() - .5) * .12;
      const cx = 450 + Math.cos(angle) * 270, cy = 300 + Math.sin(angle) * 180;
      const rx = Math.min(125, 220 * spacing), ry = Math.min(115, 145 * spacing);
      slots.push({ cx, cy, rx, ry, box: { minX: cx - rx * 1.15, maxX: cx + rx * 1.15, minY: cy - ry * 1.15, maxY: cy + ry * 1.15 } });
    }
    return slots;
  }
  if (config.layout === "scatter" && count > 1) {
    // Best-candidate placement of country centres, then sizes from the free space.
    const centres: Point[] = [];
    for (let i = 0; i < count; i++) {
      let best: Point = [450, 300], score = -1;
      for (let attempt = 0; attempt < 60; attempt++) {
        const p: Point = [110 + next() * 680, 100 + next() * 400];
        const spacing = centres.length ? Math.min(...centres.map(c => distance(p, c))) : 1000 - distance(p, [450, 300]);
        if (spacing > score) { best = p; score = spacing; }
      }
      centres.push(best);
    }
    const base = Math.sqrt(760 * 460 / count / Math.PI) * .78;
    for (const [cx, cy] of centres) {
      const nearest = Math.min(...centres.filter(c => c[0] !== cx || c[1] !== cy).map(c => distance(c, [cx, cy])));
      const size = Math.min(base * (.85 + next() * .35), nearest * .52);
      const rx = size * (.95 + next() * .3), ry = size * (.8 + next() * .25);
      slots.push({ cx, cy, rx, ry, box: { minX: 14, maxX: WIDTH - 14, minY: 14, maxY: HEIGHT - 14 } });
    }
    return slots;
  }
  const columns = config.layout === "columns" ? count : config.layout === "rows" ? 1 : Math.round(Math.sqrt(count * 1.5));
  const rows = Math.ceil(count / columns);
  const cellWidth = 780 / columns, cellHeight = 480 / rows;
  for (let i = 0; i < count; i++) {
    const column = i % columns, row = Math.floor(i / columns);
    // A short last row is centred instead of leaving an empty corner.
    const inRow = row === rows - 1 ? count - row * columns : columns;
    const offset = (columns - inRow) * cellWidth / 2;
    const minX = 60 + offset + cellWidth * column, minY = 60 + cellHeight * row;
    const inset = Math.max(CHANNEL / 2 + 2, Math.min(cellWidth, cellHeight) * .05);
    const box = { minX: minX + inset, maxX: minX + cellWidth - inset, minY: minY + inset, maxY: minY + cellHeight - inset };
    const cx = minX + cellWidth * (.5 + (next() - .5) * .1), cy = minY + cellHeight * (.5 + (next() - .5) * .1);
    slots.push({ cx, cy, rx: cellWidth * .45 * (.9 + next() * .15), ry: cellHeight * .45 * (.9 + next() * .15), box });
  }
  return slots;
}

/** Fits a coast inside its slot and away from every coast already placed. */
function fitCoast(coast: Point[], slot: Slot, placed: Point[][]): Point[] {
  const centre: Point = [slot.cx, slot.cy];
  const b = bounds(coast);
  const box = { minX: Math.max(8, slot.box.minX), maxX: Math.min(WIDTH - 8, slot.box.maxX), minY: Math.max(8, slot.box.minY), maxY: Math.min(HEIGHT - 8, slot.box.maxY) };
  const factor = Math.min(1,
    (slot.cx - box.minX) / Math.max(1e-6, slot.cx - b.minX), (box.maxX - slot.cx) / Math.max(1e-6, b.maxX - slot.cx),
    (slot.cy - box.minY) / Math.max(1e-6, slot.cy - b.minY), (box.maxY - slot.cy) / Math.max(1e-6, b.maxY - slot.cy));
  let fitted = scaleAbout(coast, centre, factor);
  for (let attempt = 0; attempt < 12 && placed.some(other => coastGap(fitted, other) < CHANNEL || fitted.some(p => containsPoint(p, other)) || other.some(p => containsPoint(p, fitted))); attempt++) fitted = scaleAbout(fitted, centre, .9);
  return fitted;
}

/** Largest-remainder split of provinces by land area, with at least two per country. */
function distributeProvinces(total: number, areas: number[]): number[] {
  const counts = areas.map(() => 2);
  const remaining = total - counts.length * 2;
  const sum = areas.reduce((a, b) => a + b, 0);
  const shares = areas.map(a => a / sum * remaining);
  shares.forEach((share, i) => counts[i] += Math.floor(share));
  const order = shares.map((share, i) => ({ i, rest: share - Math.floor(share) })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  const leftover = total - counts.reduce((a, b) => a + b, 0);
  for (let k = 0; k < leftover; k++) counts[order[k % order.length].i]++;
  return counts;
}

function placeProvinceSeeds(coast: Point[], count: number, next: () => number): Point[] {
  const b = bounds(coast);
  const extent = Math.min(b.maxX - b.minX, b.maxY - b.minY);
  const margin = Math.min(17, extent * .12);
  const candidates: Point[] = [];
  for (let attempt = 0; attempt < 5000; attempt++) {
    const p: Point = [b.minX + next() * (b.maxX - b.minX), b.minY + next() * (b.maxY - b.minY)];
    if (containsPoint(p, coast) && coastDistance(p, coast) >= margin) candidates.push(p);
  }
  const points: Point[] = [];
  // Best-candidate sampling spreads towns out without retry failures.
  while (points.length < count) {
    let best = -1, score = -1;
    candidates.forEach((p, j) => {
      const spacing = points.length ? Math.min(...points.map(q => distance(p, q))) : coastDistance(p, coast);
      if (spacing > score) { best = j; score = spacing; }
    });
    if (best < 0) throw new Error("Map is too dense: reduce provinces or countries.");
    points.push(candidates.splice(best, 1)[0]);
  }
  // Lloyd relaxation evens out province sizes while keeping towns inland.
  if (points.length > 2) for (let iteration = 0; iteration < 2; iteration++) {
    const voronoi = Delaunay.from(points).voronoi([0, 0, WIDTH, HEIGHT]);
    points.forEach((point, i) => {
      const cell = voronoi.cellPolygon(i);
      if (!cell) return;
      const target = centroid(clip(coast, Array.from(cell) as Point[]));
      if (!target) return;
      const moved: Point = [point[0] + (target[0] - point[0]) * .85, point[1] + (target[1] - point[1]) * .85];
      if (containsPoint(moved, coast) && coastDistance(moved, coast) >= margin && points.every((q, j) => j === i || distance(q, moved) > 4)) points[i] = moved;
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

function assignTerrain(lands: Land[], groups: TerritoryDefinition[][], seed: number) {
  const elevationSeed = seed ^ 0x51ed27, moistureSeed = seed ^ 0x3c6ef3;
  const mainland: { territory: TerritoryDefinition; elevation: number; moisture: number }[] = [];
  lands.forEach((land, index) => {
    const b = bounds(land.coast);
    const extent = Math.max(1, Math.min(b.maxX - b.minX, b.maxY - b.minY));
    for (const territory of groups[index]) {
      const p: Point = [territory.x, territory.y];
      const moisture = fbm(p[0] / 120, p[1] / 120, moistureSeed);
      if (land.island) { territory.terrain = moisture > .52 ? "forest" : "plains"; continue; }
      const inland = Math.min(1, coastDistance(p, land.coast) / (extent * .35));
      const ridge = land.ridge ? Math.max(0, 1 - segmentDistance(p, land.ridge[0], land.ridge[1]) / (extent * .3)) : 0;
      const elevation = inland * .4 + ridge * .45 + fbm(p[0] / 90, p[1] / 90, elevationSeed) * .35;
      mainland.push({ territory, elevation, moisture });
    }
  });
  // Quantiles keep every world readable: some peaks, a band of hills, forests and open farmland.
  const byElevation = [...mainland].sort((a, b) => b.elevation - a.elevation);
  const mountains = Math.round(mainland.length * .12), hills = Math.round(mainland.length * .2);
  const assigned = new Map<TerritoryDefinition, Terrain>();
  byElevation.forEach((entry, rank) => { if (rank < mountains) assigned.set(entry.territory, "mountains"); else if (rank < mountains + hills) assigned.set(entry.territory, "hills"); });
  const lowland = mainland.filter(entry => !assigned.has(entry.territory)).sort((a, b) => b.moisture - a.moisture);
  const forests = Math.round(lowland.length * .38);
  lowland.forEach((entry, rank) => assigned.set(entry.territory, rank < forests ? "forest" : "plains"));
  for (const [territory, terrain] of assigned) territory.terrain = terrain;
}

// ---------------------------------------------------------------------------
// Capitals
// ---------------------------------------------------------------------------

/** All-pairs travel distance: one step per land border, two per sea lane. */
function travelDistances(territories: TerritoryDefinition[]): number[][] {
  const index = new Map(territories.map((t, i) => [t.id, i]));
  return territories.map((_, source) => {
    const dist = territories.map(() => Infinity);
    dist[source] = 0;
    const done = new Set<number>();
    for (let step = 0; step < territories.length; step++) {
      let current = -1;
      for (let i = 0; i < dist.length; i++) if (!done.has(i) && (current < 0 || dist[i] < dist[current])) current = i;
      if (current < 0 || dist[current] === Infinity) break;
      done.add(current);
      const t = territories[current];
      for (const id of t.neighbours) { const j = index.get(id)!; dist[j] = Math.min(dist[j], dist[current] + 1); }
      for (const id of t.seaNeighbours) { const j = index.get(id)!; dist[j] = Math.min(dist[j], dist[current] + 2); }
    }
    return dist;
  });
}

/** Share of the map closest to each capital; ties are split. Used to keep starts fair. */
export function capitalShares(map: MapDefinition): Map<PlayerId, number> {
  const capitals = map.territories.map((t, i) => ({ t, i })).filter(({ t }) => t.capitalFor);
  const dist = travelDistances(map.territories);
  const shares = new Map<PlayerId, number>(capitals.map(({ t }) => [t.capitalFor!, 0]));
  map.territories.forEach((_, i) => {
    const best = Math.min(...capitals.map(c => dist[c.i][i]));
    const owners = capitals.filter(c => dist[c.i][i] === best);
    for (const owner of owners) shares.set(owner.t.capitalFor!, shares.get(owner.t.capitalFor!)! + 1 / owners.length);
  });
  return shares;
}

function chooseCapitals(territories: TerritoryDefinition[], players: PlayerId[]) {
  const dist = travelDistances(territories);
  const candidates = territories.map((_, i) => i).filter(i => !territories[i].island && territories[i].neighbours.length > 0);
  const pool = candidates.length >= players.length ? candidates : territories.map((_, i) => i).filter(i => !territories[i].island);
  const countries = new Set(pool.map(i => territories[i].landmassId)).size;
  let best: number[] = [], bestScore = Infinity;
  for (const start of pool) {
    const chosen = [start];
    while (chosen.length < players.length) {
      let pick = -1, pickScore = -Infinity;
      for (const i of pool) {
        if (chosen.includes(i)) continue;
        const sameCountry = chosen.some(c => territories[c].landmassId === territories[i].landmassId);
        const spacing = Math.min(...chosen.map(c => dist[c][i]));
        const score = spacing + (sameCountry && countries >= players.length ? -1000 : 0) + Math.min(3, territories[i].neighbours.length) * .1;
        if (score > pickScore) { pick = i; pickScore = score; }
      }
      chosen.push(pick);
    }
    // Fairness: the spread between the largest and smallest nearest-capital share.
    const share = chosen.map(() => 0);
    territories.forEach((_, i) => {
      const nearest = Math.min(...chosen.map(c => dist[c][i]));
      const owners = chosen.filter(c => dist[c][i] === nearest);
      owners.forEach(owner => share[chosen.indexOf(owner)] += 1 / owners.length);
    });
    const spacing = Math.min(...chosen.flatMap((a, k) => chosen.slice(k + 1).map(b => dist[a][b])));
    const score = Math.max(...share) - Math.min(...share) - spacing * .5;
    if (score < bestScore - 1e-9) { best = chosen; bestScore = score; }
  }
  best.forEach((index, k) => {
    territories[index].capitalFor = players[k];
    // Capitals are founded on open farmland: no player starts with a terrain fortress.
    territories[index].terrain = "plains";
  });
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateMap(config: MapGenerationConfig, seed: number, botCount = 1, id = "custom"): MapDefinition {
  const problem = validateMapConfig(config, seed, botCount);
  if (problem) throw new Error(`Invalid map configuration: ${problem}`);
  const next = random(seed);
  const names = createNameGenerator(random(seed ^ 0x6e616d65));
  const slots = layoutSlots(config, next);
  const coasts: Point[][] = [];
  for (const slot of slots) {
    const rotation = (next() - .5) * .5;
    coasts.push(fitCoast(outline(slot.cx, slot.cy, slot.rx, slot.ry, config.roughness, next, rotation), slot, coasts));
  }
  const counts = distributeProvinces(config.provinces, coasts.map(coast => Math.abs(area(coast))));
  const lands: Land[] = coasts.map((coast, i) => {
    const b = bounds(coast);
    const angle = next() * Math.PI, half = Math.max(b.maxX - b.minX, b.maxY - b.minY) * .32;
    const centre: Point = [(b.minX + b.maxX) / 2 + (next() - .5) * (b.maxX - b.minX) * .2, (b.minY + b.maxY) / 2 + (next() - .5) * (b.maxY - b.minY) * .2];
    const ridge: [Point, Point] = [[centre[0] - Math.cos(angle) * half, centre[1] - Math.sin(angle) * half], [centre[0] + Math.cos(angle) * half, centre[1] + Math.sin(angle) * half]];
    return { id: `country-${i + 1}`, coast, points: placeProvinceSeeds(coast, counts[i], next), island: false, name: names.country(), ridge };
  });
  // Islands gather in small archipelagos, with some scattered alone.
  const clusters: Point[] = Array.from({ length: Math.max(1, Math.round(config.islands / 5)) }, () => [60 + next() * 780, 50 + next() * 500]);
  for (let i = 0; i < config.islands; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 20000; attempt++) {
      const clustered = attempt < 400 && next() < .65;
      const cluster = clusters[Math.floor(next() * clusters.length)];
      const p: Point = clustered ? [cluster[0] + (next() - .5) * 170, cluster[1] + (next() - .5) * 130] : [30 + next() * 840, 30 + next() * 540];
      const radius = 15 + next() * 9;
      if (p[0] < radius + 6 || p[0] > WIDTH - radius - 6 || p[1] < radius + 6 || p[1] > HEIGHT - radius - 6) continue;
      if (lands.some(land => containsPoint(p, land.coast) || coastDistance(p, land.coast) < radius * 1.15 + 12)) continue;
      const coast = outline(p[0], p[1], radius, radius * (.8 + next() * .3), Math.min(1, config.roughness + .2), next, next() * Math.PI);
      lands.push({ id: `island-${i + 1}`, coast, points: [p], island: true, name: names.island() });
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
      id: `${land.id}-province-${index + 1}`, label: land.island ? land.name : names.province(),
      x, y, path: path(polygons[index]),
      // Delaunay candidates whose shared border was cut away by a bay are not land neighbours.
      neighbours: land.island ? [] : Array.from(delaunay.neighbors(index)).filter(j => [...borderKeys[index]].some(key => borderKeys[j].has(key))).map(j => `${land.id}-province-${j + 1}`),
      seaNeighbours: [], island: land.island, landmassId: land.id,
    }));
  });
  connectBySea(lands, groups);
  assignTerrain(lands, groups, seed);
  const territories = groups.flat();
  chooseCapitals(territories, ["human", ...getBotIds(botCount)] as PlayerId[]);
  const countries: CountryDefinition[] = lands.filter(land => !land.island).map(land => {
    const b = bounds(land.coast);
    return { id: land.id, name: land.name, x: (b.minX + b.maxX) / 2, y: Math.max(14, b.minY - 7) };
  });
  return { id: `${id}-${seed}`, seed, landPath: lands.map(land => path(land.coast)).join(" "), landmassCount: config.landmasses, generation: { ...config }, countries, territories };
}

/**
 * A minimum spanning network guarantees every country and island is reachable.
 * Lanes that would cross a third landmass are heavily penalised, and a couple of
 * short extra lanes per landmass avoid single naval choke points.
 */
function connectBySea(lands: Land[], groups: TerritoryDefinition[][]) {
  type Edge = { a: number; b: number; from: TerritoryDefinition; to: TerritoryDefinition; length: number; crosses: boolean; cost: number };
  const edges: Edge[] = [];
  for (let a = 0; a < groups.length; a++) for (let b = a + 1; b < groups.length; b++) {
    let pair: Edge | undefined;
    for (const from of groups[a]) for (const to of groups[b]) {
      const length = Math.hypot(from.x - to.x, from.y - to.y);
      if (pair && length >= pair.cost) continue;
      const crosses = lands.some((land, k) => k !== a && k !== b && crossesPolygon([from.x, from.y], [to.x, to.y], land.coast));
      const cost = length * (crosses ? 4 : 1);
      if (!pair || cost < pair.cost) pair = { a, b, from, to, length, crosses, cost };
    }
    edges.push(pair!);
  }
  edges.sort((x, y) => x.cost - y.cost || x.a - y.a || x.b - y.b);
  const parents = groups.map((_, i) => i);
  const root = (i: number): number => parents[i] === i ? i : root(parents[i]);
  const connect = ({ from, to }: Edge) => {
    if (!from.seaNeighbours.includes(to.id)) from.seaNeighbours.push(to.id);
    if (!to.seaNeighbours.includes(from.id)) to.seaNeighbours.push(from.id);
  };
  const spanning: Edge[] = [];
  for (const edge of edges) if (root(edge.a) !== root(edge.b)) { connect(edge); spanning.push(edge); parents[root(edge.a)] = root(edge.b); }
  const longest = Math.max(120, ...spanning.map(edge => edge.length));
  groups.forEach((_, i) => edges.filter(edge => (edge.a === i || edge.b === i) && !edge.crosses && edge.length <= longest * 1.1).slice(0, 2).forEach(connect));
}
