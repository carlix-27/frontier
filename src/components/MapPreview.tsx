import { useMemo } from "react";
import { Map, MapPin, Waves } from "lucide-react";
import { generateFrontierMap, getMapPreset } from "../engine/map";

export function MapPreview({ presetId }: { presetId: string }) {
  const preset = getMapPreset(presetId);
  const map = useMemo(() => generateFrontierMap(preset.seed, preset.id), [preset]);
  const clipId = `preview-land-${preset.id}`;
  const islandCount = map.territories.filter((territory) => territory.island).length;

  return <section className="setup-map-preview" aria-label={`Preview of ${preset.name}`}>
    <div className="setup-preview-heading"><div><p className="eyebrow">SELECTED MAP</p><h3>{preset.name}</h3><p>{preset.description}</p></div><div className="setup-preview-stats"><span><Map size={15} />{map.territories.length} provinces</span><span><Waves size={15} />{islandCount} islands</span></div></div>
    <svg className="setup-preview-svg" viewBox="0 0 900 600" role="img" aria-label={`${preset.name}: ${map.territories.length} provinces and ${islandCount} islands, with blue and red starting capitals`}>
      <defs><clipPath id={clipId}><path d={map.landPath} /></clipPath><linearGradient id={`preview-ocean-${preset.id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#5ba9c2" /><stop offset="1" stopColor="#174c6d" /></linearGradient></defs>
      <rect width="900" height="600" fill={`url(#preview-ocean-${preset.id})`} />
      <path d={map.landPath} className="preview-land" />
      <g clipPath={`url(#${clipId})`}>{map.territories.map((territory, index) => <path key={territory.id} d={territory.path} className={`preview-province tone-${index % 3} ${territory.capitalFor ?? ""}`} />)}</g>
      <path d={map.landPath} className="preview-coast" />
      {map.territories.filter((territory) => territory.capitalFor).map((territory) => <g key={territory.id} className={`preview-capital ${territory.capitalFor}`} transform={`translate(${territory.x} ${territory.y})`}><circle r="17" /><text textAnchor="middle" dominantBaseline="central">{territory.capitalFor === "human" ? "B" : "R"}</text></g>)}
    </svg>
    <div className="setup-preview-legend"><span><MapPin size={14} />Blue capital</span><span><MapPin size={14} />Red capital</span><small>This is the actual generated map for the selected match.</small></div>
  </section>;
}
