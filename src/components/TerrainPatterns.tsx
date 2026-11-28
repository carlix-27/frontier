import { TERRAINS, type Terrain } from "../engine/terrain";
import type { TerritoryDefinition } from "../engine/types";

/** Subtle terrain lighting instead of repeated illustrative symbols. */
export function TerrainPatterns({ prefix }: { prefix: string }) {
  return <>
    {(["forest", "hills", "mountains", "plains"] as const).map(terrain => <linearGradient key={terrain} id={`${prefix}-${terrain}`} x1="0" y1="0" x2=".8" y2="1">
      <stop stopColor="#f0f5df" stopOpacity={terrain === "mountains" ? ".24" : ".12"} />
      <stop offset=".5" stopColor={TERRAINS[terrain].color} stopOpacity="0" />
      <stop offset="1" stopColor="#294c43" stopOpacity={terrain === "forest" ? ".15" : ".09"} />
    </linearGradient>)}
  </>;
}

export function terrainPattern(prefix: string, terrain: Terrain) { return `url(#${prefix}-${terrain})`; }

/** Unclaimed provinces show their terrain colour on generated worlds. */
export function neutralFill(territory: TerritoryDefinition, fallback: string) {
  return territory.terrain ? TERRAINS[territory.terrain].color : fallback;
}
