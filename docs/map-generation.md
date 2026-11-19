# Map generation

The match selector includes 15 reproducible maps — five classic continents and ten generated worlds — plus a **Custom world** generator. The classic maps keep their original seeds, geometry and rules (they have no terrain).

## Generate a world

```ts
import { generateMap } from "../src/engine/map";

const map = generateMap({
  landmasses: 4,     // countries, each divided into provinces
  provinces: 40,     // total across countries, split by land area (at least 2 each)
  islands: 16,       // additional single-province islands
  layout: "scatter", // grid | columns | rows | ring | scatter
  roughness: 0.8,    // 0 = gentle shores, 1 = jagged peninsulas and bays
}, 2026, 8, "my-world"); // seed, number of bots, map ID
```

This produces 56 conquerable territories. The same configuration and seed reproduce the same map; the bot count only changes capitals. `validateMapConfig(config, seed, bots)` returns a readable problem (or `null`) without throwing, which the setup screen uses for live feedback.

Generated maps carry their configuration in `map.generation`, so a rematch of a custom world rebuilds exactly the same geography. `map.countries` holds each country's generated name and label position.

## In the browser

*Create match → Custom world* exposes every option: countries, provinces, islands, layout, coast roughness and seed (type one or roll the dice). The preview is the real generated map, including terrain and capitals, and updates as you drag. Invalid or overcrowded settings show the reason and disable *Start match*.

To add a preset, add a data entry to `src/engine/mapPresets.ts`. No React or game-rule changes are needed.

## Pipeline

1. **Layout.** Each country gets a slot: a jittered grid cell, a column/row, a position on a ring, or — for `scatter` — a best-candidate position anywhere on the map, sized by the free space around it.
2. **Coastlines.** A radial outline built from periodic harmonics, a few Gaussian peninsulas and bays, and smoothed jitter, then rotated. Radial shapes are always simple polygons. Each coast is scaled to its slot and shrunk until it keeps a 16 px channel of open water from every other coast.
3. **Provinces.** Province counts are split by land area. Best-candidate sampling spreads inland towns, then two rounds of Lloyd relaxation even out province sizes. Each province is its town's Voronoi cell clipped to the coast; land neighbours are cells that actually share a border after clipping.
4. **Islands.** Placed in a few archipelago clusters plus scattered singles, clear of every coast.
5. **Sea lanes.** A minimum spanning network links every country and island. Lanes that would cross a third landmass cost four times as much, so routes follow open water; each landmass also gets up to two short extra lanes to avoid single naval choke points.
6. **Terrain.** Elevation combines distance from the coast, a seeded mountain ridge per country and fractal noise; moisture is a second noise field. Map-wide quantiles keep every world readable: about 12% mountains, 20% hills, then forests and plains. Islands are forest or plains.
7. **Names.** A seeded syllable generator names countries, provinces and islands. Names are unique per map and short enough for labels (≤ 9 characters).
8. **Capitals.** For every possible first capital, the rest are chosen greedily to maximise travel distance (land border = 1, sea lane = 2), on different countries when possible. The set with the most even share of nearby provinces wins. Capitals are always founded on plains, so nobody starts in a terrain fortress.

## Terrain

| Terrain | Effect | Map |
| --- | --- | --- |
| Plains | +1 citizen per production cycle | Grass strokes |
| Forest | +1 defence | Trees |
| Hills | +1 defence, +1 development per cycle | Rounded ridges |
| Mountains | +2 defence | Snow-capped peaks |

Defence applies to land attacks and naval landings (`defenceOf` in `game.ts`), and bots use the same function when they judge an attack. Unclaimed provinces show their terrain colour; owned provinces keep the owner's colour with the terrain marks on top. The province menu and skill tree name each province's terrain.

## Guarantees and limits

Supported ranges: 1–12 countries, 0–30 islands, up to 96 country provinces, at least two provinces per country and enough for all capitals. Overcrowded configurations fail explicitly instead of silently changing counts. The fixed 900×600 world reads best with roughly 35–65 total provinces.

`npm test` covers seed reproducibility, exact counts, geometry inside the map, symmetric land/sea adjacency, full reachability, every layout, terrain coverage and limits, unique names, capital fairness, sea lanes through open water, custom-world rematches and the unchanged classic maps.
