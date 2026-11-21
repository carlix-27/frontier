import type { MapDefinition, TerritoryDefinition } from "./types";

type Point = [number, number];
const coastalCache = new WeakMap<MapDefinition, Set<string>>();

function vertices(path: string): Point[] {
  return [...path.matchAll(/[ML]\s*(-?[\d.]+)[,\s]+(-?[\d.]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
}

function contains(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length)) : 0;
    if (Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy) < .2) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function coastalProvinces(map: MapDefinition) {
  const cached = coastalCache.get(map);
  if (cached) return cached;
  const coast = vertices(map.landPath);
  const coastal = new Set<string>();
  for (const province of map.territories) {
    const polygon = vertices(province.path);
    if (province.island || coast.some(point => contains(point, polygon))) coastal.add(province.id);
  }
  coastalCache.set(map, coastal);
  return coastal;
}

/** Existing sea lanes and direct sailings between coastal provinces on separate landmasses. */
export function canSail(map: MapDefinition, from: TerritoryDefinition, to: TerritoryDefinition): boolean {
  if (from.id === to.id || from.neighbours.includes(to.id)) return false;
  if (from.seaNeighbours.includes(to.id)) return true;
  const landmass = (province: TerritoryDefinition) => province.landmassId ?? (province.island ? province.id : "mainland");
  if (landmass(from) === landmass(to)) return false;
  const coast = coastalProvinces(map);
  return coast.has(from.id) && coast.has(to.id);
}
