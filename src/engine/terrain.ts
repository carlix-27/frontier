/**
 * Province terrain. Terrain is assigned once by the map generator and never
 * changes during a match. Effects are deliberately small: terrain should shape
 * where you attack and what you develop, not decide the match by itself.
 */
export type Terrain = "plains" | "forest" | "hills" | "mountains";

export interface TerrainEffects {
  /** Extra defence against land attacks and naval landings. */
  defence: number;
  /** Extra citizens per production cycle. */
  growth: number;
  /** Extra local development points per production cycle. */
  research: number;
}

export interface TerrainInfo {
  id: Terrain;
  name: string;
  /** Map tint for unclaimed provinces. */
  color: string;
  description: string;
  effects: TerrainEffects;
}

export const TERRAINS: Record<Terrain, TerrainInfo> = {
  plains: { id: "plains", name: "Plains", color: "#b4c98b", description: "Fertile farmland: +1 citizen per cycle.", effects: { defence: 0, growth: 1, research: 0 } },
  forest: { id: "forest", name: "Forest", color: "#88ad78", description: "Dense woods: +1 defence.", effects: { defence: 1, growth: 0, research: 0 } },
  hills: { id: "hills", name: "Hills", color: "#c9b88b", description: "Mines and lookouts: +1 defence and +1 development per cycle.", effects: { defence: 1, growth: 0, research: 1 } },
  mountains: { id: "mountains", name: "Mountains", color: "#b0a69b", description: "Natural fortress: +2 defence.", effects: { defence: 2, growth: 0, research: 0 } },
};

export const TERRAIN_ORDER: Terrain[] = ["plains", "forest", "hills", "mountains"];

const NONE: TerrainEffects = { defence: 0, growth: 0, research: 0 };

/** Classic maps have no terrain; they keep their original rules. */
export function terrainEffects(terrain: Terrain | undefined): TerrainEffects {
  return terrain ? TERRAINS[terrain].effects : NONE;
}
