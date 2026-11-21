import { AtlasPaper, AtlasSea } from "./AtlasSheet";
import { AtlasWaters } from "./AtlasWaters";
import { useId } from "react";
import { Map, MapPin, Mountain, TriangleAlert, Waves } from "lucide-react";
import { getPlayerColor, getPlayerName } from "../engine/players";
import { TERRAIN_ORDER, TERRAINS } from "../engine/terrain";
import type { MapDefinition } from "../engine/types";
import { neutralFill, TerrainPatterns, terrainPattern } from "./TerrainPatterns";

interface Props { map: MapDefinition | null; name: string; description: string; error?: string | null }

export function MapPreview({ map, name, description, error }: Props) {
  const prefix = `preview-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  if (!map) return <section className="setup-map-preview" aria-label={`Preview of ${name}`}>
    <div className="setup-preview-heading"><div><p className="eyebrow">SELECTED MAP</p><h3>{name}</h3><p>{description}</p></div></div>
    <div className="setup-preview-error" role="alert"><TriangleAlert size={20} /><span>{error ?? "This world cannot be generated."}</span></div>
  </section>;
  const islandCount = map.territories.filter((territory) => territory.island).length;
  const capitals = map.territories.filter((territory) => territory.capitalFor);
  const terrainCounts = TERRAIN_ORDER.map((terrain) => ({ terrain, count: map.territories.filter((territory) => territory.terrain === terrain).length })).filter((entry) => entry.count > 0);

  return <section className="setup-map-preview" aria-label={`Preview of ${name}`}>
    <div className="setup-preview-heading"><div><p className="eyebrow">SELECTED MAP</p><h3>{name}</h3><p>{description}</p></div><div className="setup-preview-stats"><span><Map size={15} />{map.territories.length} provinces</span><span><MapPin size={15} />{map.landmassCount ?? 1} {(map.landmassCount ?? 1) === 1 ? "country" : "countries"}</span><span><Waves size={15} />{islandCount} small islands</span></div></div>
    <svg className="setup-preview-svg" viewBox="0 0 900 600" role="img" aria-label={`${name}: ${map.territories.length} provinces, ${islandCount} islands, and ${capitals.length} starting capitals`}>
      <defs><TerrainPatterns prefix={prefix} /><clipPath id={`${prefix}-clip`}><path d={map.landPath} /></clipPath></defs>
      <AtlasSea prefix={prefix} />
      <AtlasWaters map={map} prefix={prefix} />
      <g className="sea-lanes">{map.territories.flatMap((territory) => territory.seaNeighbours.filter((id) => id > territory.id).map((id) => { const other = map.territories.find((candidate) => candidate.id === id)!; return <line key={`${territory.id}:${id}`} x1={territory.x} y1={territory.y} x2={other.x} y2={other.y} />; }))}</g>
      <path d={map.landPath} className="shallows" />
      <path d={map.landPath} className="preview-land" />
      <g clipPath={`url(#${prefix}-clip)`}>
        {map.territories.map((territory, index) => <path key={territory.id} d={territory.path} className={`preview-province tone-${index % 3}`} style={territory.capitalFor ? { fill: getPlayerColor(territory.capitalFor) } : territory.terrain ? { fill: neutralFill(territory, "") } : undefined} />)}
        {map.territories.map((territory) => territory.terrain && <path key={`t-${territory.id}`} d={territory.path} className="terrain-overlay" fill={terrainPattern(prefix, territory.terrain)} />)}
      </g>
      <path d={map.landPath} className="preview-coast" />
      <AtlasPaper />
      {map.countries?.map((country) => <text key={country.id} x={country.x} y={country.y} className="country-name">{country.name}</text>)}
      {capitals.map((territory) => <g key={territory.id} className="preview-capital" transform={`translate(${territory.x} ${territory.y})`}><circle r="17" style={{ fill: getPlayerColor(territory.capitalFor!) }} /><text textAnchor="middle" dominantBaseline="central">{getPlayerName(territory.capitalFor!).charAt(0)}</text></g>)}
    </svg>
    <div className="setup-preview-legend">
      {capitals.map((territory) => <span key={territory.id}><MapPin size={14} style={{ color: getPlayerColor(territory.capitalFor!) }} />{getPlayerName(territory.capitalFor!)} capital</span>)}
      {terrainCounts.length > 0 && <span className="terrain-legend">{terrainCounts.map(({ terrain, count }) => <span key={terrain} title={TERRAINS[terrain].description}><i style={{ background: TERRAINS[terrain].color }} />{TERRAINS[terrain].name} {count}</span>)}<Mountain size={14} /></span>}
      <small>This is the actual generated map for the selected match.</small>
    </div>
  </section>;
}
