import { Dices, Globe2, Grid3x3, Columns3, Rows3, CircleDot, Sparkles } from "lucide-react";
import { MAP_LIMITS } from "../engine/map";
import type { MapGenerationConfig, MapLayout } from "../engine/types";

const layouts: { id: MapLayout; name: string; icon: typeof Grid3x3 }[] = [
  { id: "scatter", name: "Scattered", icon: Sparkles },
  { id: "grid", name: "Grid", icon: Grid3x3 },
  { id: "columns", name: "Columns", icon: Columns3 },
  { id: "rows", name: "Rows", icon: Rows3 },
  { id: "ring", name: "Ring", icon: CircleDot },
];

interface Props {
  config: MapGenerationConfig;
  seed: number;
  players: number;
  onChange: (config: MapGenerationConfig) => void;
  onSeedChange: (seed: number) => void;
}

/** Minimum provinces: two per country and one per starting capital. */
export function minimumProvinces(landmasses: number, players: number) { return Math.max(landmasses * 2, players + 1); }

export function CustomWorldControls({ config, seed, players, onChange, onSeedChange }: Props) {
  const minimum = minimumProvinces(config.landmasses, players);
  const update = (patch: Partial<MapGenerationConfig>) => {
    const next = { ...config, ...patch };
    onChange({ ...next, provinces: Math.max(minimumProvinces(next.landmasses, players), Math.min(MAP_LIMITS.provinces[1], next.provinces)) });
  };
  const slider = (label: string, value: number, min: number, max: number, onInput: (value: number) => void, hint?: string) => <label className="world-slider">
    <span><strong>{label}</strong><output>{value}</output></span>
    <input type="range" min={min} max={max} value={value} onChange={(event) => onInput(Number(event.target.value))} />
    {hint && <small>{hint}</small>}
  </label>;
  const total = config.provinces + config.islands;
  return <section className="custom-world" aria-label="Custom world settings">
    <div className="custom-world-heading"><Globe2 size={18} /><div><strong>World generator</strong><small>Every setting is reproducible: share the seed and settings to replay this exact world.</small></div></div>
    <div className="custom-world-grid">
      {slider("Countries", config.landmasses, MAP_LIMITS.landmasses[0], MAP_LIMITS.landmasses[1], (landmasses) => update({ landmasses }))}
      {slider("Country provinces", config.provinces, minimum, MAP_LIMITS.provinces[1], (provinces) => update({ provinces }), `At least ${minimum} for ${config.landmasses} ${config.landmasses === 1 ? "country" : "countries"} and ${players} capitals.`)}
      {slider("Islands", config.islands, MAP_LIMITS.islands[0], MAP_LIMITS.islands[1], (islands) => update({ islands }))}
      {slider("Coast roughness", Math.round(config.roughness * 100), 0, 100, (value) => update({ roughness: value / 100 }), config.roughness < .35 ? "Gentle shores" : config.roughness < .7 ? "Bays and capes" : "Jagged peninsulas")}
    </div>
    <div className="custom-world-row">
      <div className="layout-picker" role="radiogroup" aria-label="Country layout">{layouts.map(({ id, name, icon: Icon }) => <button key={id} type="button" role="radio" aria-checked={config.layout === id} className={config.layout === id ? "active" : ""} onClick={() => update({ layout: id })}><Icon size={15} />{name}</button>)}</div>
      <label className="seed-input"><span>Seed</span><input type="number" value={seed} onChange={(event) => onSeedChange(Math.trunc(Number(event.target.value) || 0))} /><button type="button" onClick={() => onSeedChange(Math.floor(Math.random() * 1_000_000))} aria-label="Random seed"><Dices size={16} /></button></label>
    </div>
    <small className="custom-world-total">{total} conquerable territories. The fixed 900 × 600 world reads best with roughly 35–65.</small>
  </section>;
}
