import type { SkillId } from "./population";
import type { Terrain } from "./terrain";
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
  /** Generated worlds only; classic maps have no terrain. */
  terrain?: Terrain;
}

export type MapLayout = "grid" | "columns" | "rows" | "ring" | "scatter";
/** Counts are exact: provinces belong to countries; each small island adds one province. */
export interface MapGenerationConfig {
  landmasses: number;
  islands: number;
  provinces: number;
  layout: MapLayout;
  /** 0 = gentle coasts, 1 = jagged coasts with peninsulas and bays. */
  roughness: number;
}

export interface CountryDefinition {
  id: string;
  name: string;
  /** Label anchor, just above the country's coast. */
  x: number;
  y: number;
}

export interface MapDefinition {
  id: string;
  seed: number;
  landPath: string;
  landmassCount?: number;
  /** Present on generated worlds so a rematch can rebuild the exact same map. */
  generation?: MapGenerationConfig;
  countries?: CountryDefinition[];
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
  /** A planned skill. The province learns the missing path automatically when it can afford each step. */
  researchGoal?: SkillId;
}

export interface GameEvent {
  tick: number;
  message: string;
  diplomacy?: { proposer: PlayerId; responder: PlayerId; accepted: boolean; reason: string };
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
  allianceCooldowns?: Record<string, number>;
  pendingAlliances?: Array<{ proposer: PlayerId; responder: PlayerId; resolveAt: number; roll: number }>;
  allianceAttempts?: Record<string, number>;
  diplomacyResults?: Array<{ id: string; proposer: PlayerId; responder: PlayerId; accepted: boolean; reason: string }>;
  tradeRoutes: TradeRoute[];
  invasions: SeaInvasion[];
  tradeCredits: Record<PlayerId, number>;
  events: GameEvent[];
  recentBattles?: BattleReport[];
  winner: PlayerId | "draw" | null;
}

export interface BattleReport {
  territory: TerritoryId;
  attacker: PlayerId;
  defender: PlayerId;
  tick: number;
  outcome: "approaching" | "captured" | "repelled";
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

export type GameCommand = ExpandCommand | FortifyCommand | SupplyCommand | TradeCommand | AllianceCommand | BuildCommand | UpgradeCommand | ResearchCommand | PlanResearchCommand;

export interface ResearchCommand { type: "research"; player: PlayerId; territory: TerritoryId; skill: SkillId }
/** Set (or clear, with `skill: null`) a province's research goal. */
export interface PlanResearchCommand { type: "planResearch"; player: PlayerId; territory: TerritoryId; skill: SkillId | null }

export type CommandResult =
  | { ok: true; state: GameState }
  | { ok: false; state: GameState; reason: string };
