import { TERRAINS, type Terrain } from "../engine/terrain";
import type { TerritoryDefinition } from "../engine/types";

/**
 * Hand-drawn terrain marks shared by the match map and the setup preview.
 * Patterns use map coordinates, so marks line up across province borders.
 */
export function TerrainPatterns({ prefix }: { prefix: string }) {
  return <>
    <pattern id={`${prefix}-forest`} width="18" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
      <g className="terrain-mark forest-mark"><path d="M4,9 L7.5,2 L11,9 Z" /><path d="M7,9 V11.5" /><path d="M12,16 L15,10 L18,16 Z" /></g>
    </pattern>
    <pattern id={`${prefix}-hills`} width="26" height="17" patternUnits="userSpaceOnUse">
      <g className="terrain-mark hills-mark"><path d="M2,10 Q7,3.5 12,10" /><path d="M14,16 Q19,9.5 24,16" /></g>
    </pattern>
    <pattern id={`${prefix}-mountains`} width="30" height="22" patternUnits="userSpaceOnUse">
      <g className="terrain-mark mountain-mark"><path d="M2,15 L9,4 L16,15" /><path d="M6.6,8.6 L9,4 L11.4,8.6 L9,7.4 Z" className="snow" /><path d="M16,21 L22,12 L28,21" /></g>
    </pattern>
    <pattern id={`${prefix}-plains`} width="22" height="20" patternUnits="userSpaceOnUse">
      <g className="terrain-mark plains-mark"><path d="M3,8 l2,-3 M6,8 l1,-3.5 M15,18 l2,-3 M18,18 l1,-3.5" /></g>
    </pattern>
  </>;
}

export function terrainPattern(prefix: string, terrain: Terrain) { return `url(#${prefix}-${terrain})`; }

/** Unclaimed provinces show their terrain colour on generated worlds. */
export function neutralFill(territory: TerritoryDefinition, fallback: string) {
  return territory.terrain ? TERRAINS[territory.terrain].color : fallback;
}
