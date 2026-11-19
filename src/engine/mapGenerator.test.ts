import { describe, expect, it } from "vitest";
import { CUSTOM_MAP_ID, getMapName, MAP_PRESETS, generateFrontierMap } from "./map";
import { capitalShares, containsPoint, generateMap, MAP_LAYOUTS, validateMapConfig, type MapGenerationConfig } from "./mapGenerator";
import { advanceGame, applyCommand, createInitialGame, createRematch, defenceOf } from "./game";
import { TERRAIN_ORDER } from "./terrain";

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
  it("gives every generated province terrain, a unique name and a plains capital", () => {
    for (const preset of MAP_PRESETS.filter(p => p.generation)) {
      const map = generateFrontierMap(preset.seed, preset.id, 3);
      expect(map.territories.every(t => !!t.terrain && TERRAIN_ORDER.includes(t.terrain))).toBe(true);
      expect(new Set(map.territories.map(t => t.label)).size).toBe(map.territories.length);
      expect(map.territories.every(t => t.label.length <= 9)).toBe(true);
      expect(map.territories.filter(t => t.capitalFor).every(t => t.terrain === "plains")).toBe(true);
      expect(map.countries).toHaveLength(preset.generation!.landmasses);
      const mainland = map.territories.filter(t => !t.island);
      for (const terrain of TERRAIN_ORDER) expect(mainland.some(t => t.terrain === terrain)).toBe(true);
      expect(mainland.filter(t => t.terrain === "mountains").length).toBeLessThanOrEqual(Math.ceil(mainland.length * .15));
    }
  });
  it("keeps classic maps free of terrain so their rules are unchanged", () => {
    expect(generateFrontierMap(27, "crownlands").territories.every(t => t.terrain === undefined)).toBe(true);
  });
  it("supports every layout, including scattered countries", () => {
    for (const layout of MAP_LAYOUTS) {
      for (const landmasses of [1, 3, 7]) {
        const map = generateMap({ ...config, layout, landmasses, provinces: 30 }, 5 + landmasses, 4);
        expect(map.territories.filter(t => !t.island)).toHaveLength(30);
        expect(new Set(map.territories.filter(t => !t.island).map(t => t.landmassId)).size).toBe(landmasses);
      }
    }
  });
  it("chooses fair capitals: no player starts with far less nearby land than another", () => {
    for (const preset of MAP_PRESETS.filter(p => p.generation)) {
      for (const bots of [1, 3]) {
        const shares = [...capitalShares(generateFrontierMap(preset.seed, preset.id, bots)).values()];
        const average = shares.reduce((a, b) => a + b, 0) / shares.length;
        expect(Math.min(...shares)).toBeGreaterThanOrEqual(average * .5);
      }
    }
  });
  it("routes most sea lanes through open water", () => {
    const map = generateFrontierMap(1508, "island-frontier", 3);
    const coasts = map.landPath.split(" Z").filter(p => p.trim()).map(vertices);
    const lanes = map.territories.flatMap(t => t.seaNeighbours.filter(id => id > t.id).map(id => [t, map.territories.find(o => o.id === id)!] as const));
    const crossing = lanes.filter(([a, b]) => coasts.some(coast => {
      const own = [a, b].some(t => containsPoint([t.x, t.y], coast));
      if (own) return false;
      return Array.from({ length: 20 }, (_, i) => (i + .5) / 20).some(f => containsPoint([a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f], coast));
    }));
    expect(crossing.length).toBeLessThanOrEqual(Math.floor(lanes.length * .1));
  });
  it("explains invalid custom settings and rebuilds a custom world for a rematch", () => {
    expect(validateMapConfig({ ...config, provinces: 5 }, 1, 1)).toContain("at least 8");
    expect(validateMapConfig({ ...config, layout: "spiral" as never })).toBe("Unknown layout.");
    expect(validateMapConfig(config, 1, 8)).toBeNull();
    const custom = { landmasses: 5, provinces: 34, islands: 7, layout: "scatter" as const, roughness: .4 };
    const game = createInitialGame(300, 4242, CUSTOM_MAP_ID, 2, custom);
    expect(game.map.generation).toEqual(custom);
    expect(getMapName(game.map)).toBe("Custom world");
    expect(createRematch({ ...game, winner: "human" }).map).toEqual(game.map);
  });
  it("adds terrain defence and growth to generated provinces", () => {
    const game = createInitialGame(300, 842, "four-kingdoms", 1);
    const mountain = game.map.territories.find(t => t.terrain === "mountains" && !t.capitalFor)!;
    const forest = game.map.territories.find(t => t.terrain === "forest" && !t.capitalFor)!;
    expect(defenceOf(game, mountain.id)).toBe(game.territories[mountain.id].units + 2);
    expect(defenceOf(game, forest.id)).toBe(game.territories[forest.id].units + 1);
    const capital = game.map.territories.find(t => t.capitalFor === "human")!;
    const grown = advanceGame({ ...game, tick: 2 });
    // Capital base growth 3, housing 2, plains 1.
    expect(grown.territories[capital.id].population - game.territories[capital.id].population).toBe(6);
    // Three attackers beat a 2-unit neutral garrison on open land, but not in the mountains.
    const source = mountain.neighbours[0];
    const owned = { ...game, territories: { ...game.territories, [source]: { ...game.territories[source], owner: "human" as const, units: 10 } } };
    const result = applyCommand(owned, { type: "expand", player: "human", from: source, to: mountain.id, units: 3 });
    expect(result.state.territories[mountain.id].owner).toBeNull();
  });
});