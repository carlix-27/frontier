import { describe, expect, it } from "vitest";
import { MAP_PRESETS, generateFrontierMap } from "./map";
import { containsPoint, generateMap, type MapGenerationConfig } from "./mapGenerator";
import { createInitialGame, createRematch } from "./game";

const config: MapGenerationConfig = { landmasses: 4, provinces: 32, islands: 12, layout: "grid", roughness: .8 };
const vertices = (path: string): [number, number][] => [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(match => [Number(match[1]), Number(match[2])]);

describe("configurable geography", () => {
  it("keeps five classic maps and adds ten distinct configurations", () => {
    expect(MAP_PRESETS).toHaveLength(15);
    expect(MAP_PRESETS.filter(p => !p.generation)).toHaveLength(5);
    expect(new Set(MAP_PRESETS.map(p => p.id)).size).toBe(15);
  });
  it("reproduces a seed and changes geography with another seed", () => {
    expect(generateMap(config, 42)).toEqual(generateMap(config, 42));
    expect(generateMap(config, 42).landPath).not.toBe(generateMap(config, 43).landPath);
  });
  for (const preset of MAP_PRESETS.filter(p => p.generation)) {
    it(`${preset.name}: exact counts, valid geometry, eight bots and reachable territory`, () => {
      for (const seed of [preset.seed, 1, 999]) {
        const map = generateFrontierMap(seed, preset.id, 8);
        const settings = preset.generation!;
        expect(map.territories).toHaveLength(settings.provinces + settings.islands);
        expect(map.territories.filter(t => t.island)).toHaveLength(settings.islands);
        expect(new Set(map.territories.map(t => t.landmassId)).size).toBe(settings.landmasses + settings.islands);
        expect(map.territories.filter(t => t.capitalFor)).toHaveLength(9);
        const coasts = map.landPath.split(" Z").filter(p => p.trim()).map(vertices);
        for (const territory of map.territories) {
          const polygon = vertices(territory.path);
          expect(polygon.length).toBeGreaterThanOrEqual(3);
          expect(containsPoint([territory.x, territory.y], polygon)).toBe(true);
          expect(coasts.filter(coast => containsPoint([territory.x, territory.y], coast))).toHaveLength(1);
          expect(polygon.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 900 && y >= 0 && y <= 600)).toBe(true);
          for (const id of territory.neighbours) {
            const other = map.territories.find(t => t.id === id)!;
            expect(other.landmassId).toBe(territory.landmassId);
            expect(other.neighbours).toContain(territory.id);
          }
          for (const id of territory.seaNeighbours) {
            const other = map.territories.find(t => t.id === id)!;
            expect(other.landmassId).not.toBe(territory.landmassId);
            expect(other.seaNeighbours).toContain(territory.id);
          }
        }
        const visited = new Set<string>();
        const queue = [map.territories[0].id];
        while (queue.length) {
          const id = queue.pop()!;
          if (visited.has(id)) continue;
          visited.add(id);
          const territory = map.territories.find(t => t.id === id)!;
          queue.push(...territory.neighbours, ...territory.seaNeighbours);
        }
        expect(visited.size).toBe(map.territories.length);
      }
    });
  }
  it("supports a single country without islands and replays a generated preset exactly", () => {
    const map = generateMap({ ...config, landmasses: 1, islands: 0 }, 77, 8);
    expect(map.territories).toHaveLength(32);
    expect(map.territories.every(t => t.seaNeighbours.length === 0)).toBe(true);
    const game = createInitialGame(300, 731, "three-crowns", 8);
    expect(createRematch(game).map).toEqual(game.map);
  });
  it("rejects impossible or non-finite options instead of silently changing counts", () => {
    for (const invalid of [{ islands: -1 }, { landmasses: 0 }, { provinces: 2 }, { islands: 100 }, { roughness: NaN }, { provinces: 3.5 }]) {
      expect(() => generateMap({ ...config, ...invalid }, 42)).toThrow();
    }
  });
});
