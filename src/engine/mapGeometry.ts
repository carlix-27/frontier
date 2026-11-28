import type { MapDefinition } from "./types";

type Point = [number, number];

/** A continuous deformation keeps both sides of a shared border together. */
function naturalPoint([x, y]: Point): Point {
  return [
    x + Math.sin(y * .28 + Math.sin(x * .07)) * 1.6 + Math.sin(y * .67 + x * .31) * .35,
    y + Math.sin(x * .24 + Math.sin(y * .08)) * 1.3 + Math.sin(x * .59 - y * .22) * .3,
  ];
}

function naturalPath(path: string): string {
  return path.split(/Z/i).filter(part => part.trim()).map(part => {
    const vertices: Point[] = [...part.matchAll(/[ML]\s*(-?[\d.]+)[,\s]+(-?[\d.]+)/g)]
      .map(match => [Number(match[1]), Number(match[2])]);
    const points: Point[] = [];
    for (let i = 0; i < vertices.length; i++) {
      const start = vertices[i], end = vertices[(i + 1) % vertices.length];
      const steps = Math.max(1, Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / 2));
      for (let step = 0; step < steps; step++) {
        const t = step / steps;
        points.push(naturalPoint([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]));
      }
    }
    return `M${points.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" L")} Z`;
  }).join(" ");
}

export function naturalizeMap(map: MapDefinition): MapDefinition {
  return {
    ...map,
    landPath: naturalPath(map.landPath),
    territories: map.territories.map(territory => {
      const [x, y] = naturalPoint([territory.x, territory.y]);
      return { ...territory, x, y, path: naturalPath(territory.path) };
    }),
    countries: map.countries?.map(country => {
      const [x, y] = naturalPoint([country.x, country.y]);
      return { ...country, x, y };
    }),
  };
}
