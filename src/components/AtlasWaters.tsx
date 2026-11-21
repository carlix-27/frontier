import { useMemo } from "react";
import type { MapDefinition } from "../engine/types";

const OCEAN_NAMES = ["Aurelian Ocean", "Mistral Ocean", "Silver Sea", "Ocean of Dawn", "Emerald Sea", "Western Ocean", "Sapphire Sea", "Northern Ocean"];

function placeOceanNames(map: MapDefinition) {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return [];
  const land = new Path2D(map.landPath);
  const anchors = [...map.territories, ...(map.countries ?? [])];
  type OceanLabel = { x: number; y: number; name: string; angle: number; compact: boolean };
  const placed: OceanLabel[] = [];
  // Narrow coastal seas can use smaller labels aligned along the map edge.
  for (const profile of [{ halfWidth: 95, halfHeight: 24, angle: 0 }, { halfWidth: 63, halfHeight: 14, angle: 0 }, { halfWidth: 63, halfHeight: 14, angle: -90 }]) {
    if (placed.length) break;
    const candidates: Array<{ x: number; y: number; clearance: number }> = [];
    for (let y = 35; y <= 565; y += 15) {
      for (let x = 30; x <= 870; x += 15) {
        if (y < 115 && (x < 220 || x > 680)) continue;
        let clear = true;
        for (let dy = -profile.halfHeight; dy <= profile.halfHeight && clear; dy += 7) {
          for (let dx = -profile.halfWidth; dx <= profile.halfWidth; dx += 7) {
            const px = x + (profile.angle ? dy : dx);
            const py = y + (profile.angle ? dx : dy);
            if (px < 18 || px > 882 || py < 18 || py > 582 || context.isPointInPath(land, px, py)) { clear = false; break; }
          }
        }
        if (!clear) continue;
        const clearance = Math.min(...anchors.map(point => Math.hypot(point.x - x, point.y - y)));
        if (clearance >= (profile.halfWidth === 95 ? 55 : 30)) candidates.push({ x, y, clearance });
      }
    }
    candidates.sort((a, b) => b.clearance - a.clearance);
    for (const candidate of candidates) {
      if (placed.some(other => Math.hypot(other.x - candidate.x, other.y - candidate.y) < 240)) continue;
      const index = ((map.seed >>> 0) + placed.length * 3) % OCEAN_NAMES.length;
      placed.push({ x: candidate.x, y: candidate.y, name: OCEAN_NAMES[index], angle: profile.angle, compact: profile.halfWidth < 95 });
      if (placed.length === 3) break;
    }
  }
  return placed;
}

/** Ink waves are masked to the sea; ocean names use clear water between landmasses. */
export function AtlasWaters({ map, prefix }: { map: MapDefinition; prefix: string }) {
  const names = useMemo(() => placeOceanNames(map), [map]);
  return <g className="atlas-waters" pointerEvents="none" aria-hidden="true">
    <defs>
      <mask id={`${prefix}-water-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="900" height="600" style={{ maskType: "luminance" }}>
        <rect width="900" height="600" fill="white" />
        <path d={map.landPath} fill="black" stroke="black" strokeWidth="14" />
      </mask>
      <pattern id={`${prefix}-waves`} width="125" height="85" patternUnits="userSpaceOnUse">
        <g className="ocean-waves" transform="translate(24 26)">
          <path d="M0,5 C5,5 8,-5 13,-5 C17,-5 19,-2 19,1 C15,-1 13,2 14,5 C17,8 23,5 25,1 C28,-5 33,-6 36,-3 C39,-1 39,1 39,2 C34,0 33,3 35,5 C38,7 43,6 47,4" />
          <path d="M4,11 Q12,8 20,11 T37,11" />
        </g>
      </pattern>
    </defs>
    <rect width="900" height="600" fill={`url(#${prefix}-waves)`} mask={`url(#${prefix}-water-mask)`} />
    {names.map(ocean => <g key={ocean.name} transform={`translate(${ocean.x} ${ocean.y}) rotate(${ocean.angle})`}>
      <rect x={ocean.compact ? -63 : -92} y="-14" width={ocean.compact ? 126 : 184} height="28" rx="14" className="ocean-name-wash" />
      <text className={ocean.compact ? "ocean-name compact" : "ocean-name"} textAnchor="middle" dominantBaseline="middle">{ocean.name}</text>
    </g>)}
  </g>;
}
