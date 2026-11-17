# Map generation

The match selector includes 15 reproducible maps: five original continents and ten configurable worlds. The original maps keep their previous seeds and generation behavior.

## Generate a world

```ts
import { generateMap } from "../src/engine/map";

const map = generateMap({
  landmasses: 4, // large countries, each divided into provinces
  provinces: 40, // total across countries, distributed evenly
  islands: 16,   // additional single-province islands
  layout: "grid", // grid | columns | rows | ring
  roughness: 0.8, // coastline irregularity from 0 to 1
}, 2026, 8, "my-world"); // seed, number of bots, map ID
```

This produces 56 conquerable territories. The same configuration and seed reproduce the same map; bot count only changes capitals. Countries are geographic landmasses, initially neutral except for player capitals, rather than territories already owned by a nation.

Add a data entry to `src/engine/mapPresets.ts` to make a world available in the match selector. No React or game-rule changes are needed. The preview and match use the same generator. Custom generation is currently an engine API; the UI selects the 15 presets.

## Geometry and gameplay

- Seeded radial coastlines fit separated layout slots, leaving water channels.
- Inland best-candidate sampling spreads province centers apart.
- Each country has its own Voronoi partition. Province polygons are clipped to its coastline, rather than a combined world mask.
- Land adjacency stays within each country. A minimum spanning maritime network plus nearby alternatives connects every country and island.
- Capitals spread across countries first, then across available provinces, supporting one player and up to eight bots.
- Existing ships, invasion, supply, and bot rules consume the generated adjacency graph.

Supported ranges: 1–12 countries, 0–30 islands, up to 96 country provinces, at least two provinces per country and enough for all capitals. Overcrowded configurations fail explicitly. The fixed 900×600 world is best suited to roughly 35–65 total provinces; larger counts can crowd labels. Sea links represent strategic travel connections; water obstacle pathfinding for ship animation remains separate from generation.

Run `npm test` for seed reproducibility, counts, geometry, adjacency, reachability, capitals, replay compatibility and legacy behavior. Run `npm run build` for TypeScript and production compilation.
