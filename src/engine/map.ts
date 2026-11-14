import type { TerritoryDefinition, TerritoryId } from "./types";

export const territoryDefinitions: TerritoryDefinition[] = [
  { id: "harbor", label: "Harbor", x: 110, y: 300, neighbours: ["ridge", "grove"], capital: true },
  { id: "ridge", label: "Ridge", x: 250, y: 180, neighbours: ["harbor", "grove", "crossing"] },
  { id: "grove", label: "Grove", x: 250, y: 420, neighbours: ["harbor", "ridge", "crossing", "marsh"] },
  { id: "crossing", label: "Crossing", x: 420, y: 290, neighbours: ["ridge", "grove", "heights", "marsh"] },
  { id: "heights", label: "Heights", x: 560, y: 170, neighbours: ["crossing", "citadel", "fields"] },
  { id: "marsh", label: "Marsh", x: 560, y: 440, neighbours: ["grove", "crossing", "citadel", "fields"] },
  { id: "fields", label: "Fields", x: 700, y: 300, neighbours: ["heights", "marsh", "citadel"] },
  { id: "citadel", label: "Citadel", x: 850, y: 300, neighbours: ["heights", "marsh", "fields"], capital: true }
];

export const territoriesById = Object.fromEntries(
  territoryDefinitions.map((territory) => [territory.id, territory]),
) as Record<TerritoryId, TerritoryDefinition>;

export function linkId(first: TerritoryId, second: TerritoryId): string {
  return [first, second].sort().join(":");
}
