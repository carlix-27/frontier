export type PlayerId = "human" | "bot";

export type TerritoryId = string;

export interface TerritoryDefinition {
  id: TerritoryId;
  label: string;
  x: number;
  y: number;
  path: string;
  neighbours: TerritoryId[];
  capitalFor?: PlayerId;
}

export interface MapDefinition {
  id: string;
  seed: number;
  landPath: string;
  territories: TerritoryDefinition[];
}

export interface TerritoryState {
  owner: PlayerId | null;
  units: number;
  population: number;
  fortification: number;
}

export interface GameEvent {
  tick: number;
  message: string;
  movement?: {
    from: TerritoryId;
    to: TerritoryId;
    player: PlayerId;
    units: number;
  };
  capture?: {
    territory: TerritoryId;
    from: TerritoryId;
    player: PlayerId;
    previousOwner: PlayerId | null;
  };
}

export interface GameState {
  tick: number;
  maxTicks: number;
  map: MapDefinition;
  territories: Record<TerritoryId, TerritoryState>;
  suppliedLinks: string[];
  events: GameEvent[];
  winner: PlayerId | "draw" | null;
}

export interface ExpandCommand {
  type: "expand";
  player: PlayerId;
  from: TerritoryId;
  to: TerritoryId;
}

export interface FortifyCommand {
  type: "fortify";
  player: PlayerId;
  territory: TerritoryId;
}

export interface SupplyCommand {
  type: "supply";
  player: PlayerId;
  from: TerritoryId;
  to: TerritoryId;
}

export type GameCommand = ExpandCommand | FortifyCommand | SupplyCommand;

export type CommandResult =
  | { ok: true; state: GameState }
  | { ok: false; state: GameState; reason: string };
