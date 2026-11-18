import type { SkillId } from "./population";
export type PlayerId = "human" | "bot" | `bot-${number}`;
export type BuildingType = "housing" | "factory" | "railway";
export type PopulationUpgrade = "housing" | "industry" | "militia";

export type TerritoryId = string;

export interface TerritoryDefinition {
  id: TerritoryId;
  label: string;
  x: number;
  y: number;
  path: string;
  neighbours: TerritoryId[];
  seaNeighbours: TerritoryId[];
  island?: boolean;
  landmassId?: string;
  capitalFor?: PlayerId;
}

export interface MapDefinition {
  id: string;
  seed: number;
  landPath: string;
  landmassCount?: number;
  territories: TerritoryDefinition[];
}

export interface TerritoryState {
  owner: PlayerId | null;
  units: number;
  population: number;
  fortification: number;
  buildings: BuildingType[];
  upgrades: Partial<Record<PopulationUpgrade, number>>;
  skills?: SkillId[];
  development?: number;
}

export interface GameEvent {
  tick: number;
  message: string;
  movement?: {
    from: TerritoryId;
    to: TerritoryId;
    player: PlayerId;
    units: number;
    bySea?: boolean;
    byRoad?: boolean;
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
  roadLinks: string[];
  suppliedLinks: string[];
  alliances: string[];
  tradeRoutes: TradeRoute[];
  invasions: SeaInvasion[];
  tradeCredits: Record<PlayerId, number>;
  events: GameEvent[];
  winner: PlayerId | "draw" | null;
}

export interface SeaInvasion {
  from: TerritoryId;
  to: TerritoryId;
  player: PlayerId;
  units: number;
  arrivalTick: number;
  attackBonus?: number;
}

export interface TradeRoute {
  id: string;
  from: TerritoryId;
  to: TerritoryId;
  player: PlayerId;
  recipient: PlayerId;
}

export interface ExpandCommand {
  type: "expand";
  player: PlayerId;
  from: TerritoryId;
  to: TerritoryId;
  units?: number;
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

export interface TradeCommand {
  type: "trade";
  player: PlayerId;
  from: TerritoryId;
  to: TerritoryId;
}

export type AllianceCommand =
  | { type: "ally"; player: PlayerId; with: PlayerId }
  | { type: "endAlliance"; player: PlayerId; with: PlayerId };

export interface BuildCommand {
  type: "build";
  player: PlayerId;
  territory: TerritoryId;
  building: BuildingType;
}
export interface UpgradeCommand {
  type: "upgrade";
  player: PlayerId;
  territory: TerritoryId;
  upgrade: PopulationUpgrade;
}

export type GameCommand = ExpandCommand | FortifyCommand | SupplyCommand | TradeCommand | AllianceCommand | BuildCommand | UpgradeCommand | { type: "research"; player: PlayerId; territory: TerritoryId; skill: SkillId };

export type CommandResult =
  | { ok: true; state: GameState }
  | { ok: false; state: GameState; reason: string };
