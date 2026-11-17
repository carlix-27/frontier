import type { MapPreset } from "./mapGenerator";

export const GENERATED_MAP_PRESETS: MapPreset[] = [
  { id: "twin-realms", name: "Twin Realms", seed: 620, description: "Two countries across a wide strait", generation: { landmasses: 2, islands: 10, provinces: 36, layout: "columns", roughness: .7 } },
  { id: "three-crowns", name: "Three Crowns", seed: 731, description: "Three rival countries and offshore islands", generation: { landmasses: 3, islands: 12, provinces: 36, layout: "columns", roughness: .9 } },
  { id: "four-kingdoms", name: "Four Kingdoms", seed: 842, description: "Four realms around intersecting seas", generation: { landmasses: 4, islands: 8, provinces: 40, layout: "grid", roughness: .5 } },
  { id: "northern-passage", name: "Northern Passage", seed: 953, description: "Northern and southern shores", generation: { landmasses: 2, islands: 16, provinces: 40, layout: "rows", roughness: 1 } },
  { id: "broken-crown", name: "Broken Crown", seed: 1064, description: "Five countries around an inland sea", generation: { landmasses: 5, islands: 12, provinces: 40, layout: "ring", roughness: 1 } },
  { id: "merchant-sea", name: "Merchant Sea", seed: 1175, description: "Six realms connected by sea lanes", generation: { landmasses: 6, islands: 16, provinces: 42, layout: "grid", roughness: .4 } },
  { id: "sunken-empire", name: "Sunken Empire", seed: 1286, description: "Eight fragmented island countries", generation: { landmasses: 8, islands: 18, provinces: 40, layout: "grid", roughness: .85 } },
  { id: "atoll-kingdoms", name: "Atoll Kingdoms", seed: 1397, description: "Seven countries encircle a lagoon", generation: { landmasses: 7, islands: 10, provinces: 35, layout: "ring", roughness: .6 } },
  { id: "island-frontier", name: "Island Frontier", seed: 1508, description: "Three large realms and 24 small islands", generation: { landmasses: 3, islands: 24, provinces: 36, layout: "grid", roughness: 1 } },
  { id: "shattered-world", name: "Shattered World", seed: 1619, description: "Twelve countries in a scattered world", generation: { landmasses: 12, islands: 20, provinces: 48, layout: "grid", roughness: .9 } },
];
