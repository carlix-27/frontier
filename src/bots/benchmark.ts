import { advanceGame, applyCommand, createInitialGame, getControlScore } from "../engine/game";
import { getMatchPlayers, isPlayerAlive } from "../engine/players";
import type { GameState, PlayerId } from "../engine/types";
import { chooseBotCommand, type BotDifficulty } from "./basicBot";

/**
 * Headless bot-versus-bot matches for balance work. Every commander, including
 * Blue, is played by the same bot logic the browser uses, so results show how
 * the rules play out rather than how a human plays.
 */
export interface BenchmarkScenario {
  name: string;
  presetId: string;
  seed: number;
  bots: number;
  difficulty: BotDifficulty;
  maxTicks: number;
}

export interface BenchmarkResult {
  scenario: BenchmarkScenario;
  winner: PlayerId | "draw";
  /** Game seconds until the match ended. */
  ticks: number;
  /** Whether the match ended by capital capture rather than the clock. */
  decisive: boolean;
  scores: Record<string, number>;
  skillsLearned: number;
  territoriesClaimed: number;
}

export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  { name: "Classic duel", presetId: "crownlands", seed: 27, bots: 1, difficulty: "normal", maxTicks: 300 },
  { name: "Twin Realms duel", presetId: "twin-realms", seed: 620, bots: 1, difficulty: "normal", maxTicks: 300 },
  { name: "Four Kingdoms, expert", presetId: "four-kingdoms", seed: 842, bots: 3, difficulty: "expert", maxTicks: 300 },
  { name: "Island Frontier, easy", presetId: "island-frontier", seed: 1508, bots: 2, difficulty: "easy", maxTicks: 300 },
  { name: "Shattered World melee", presetId: "shattered-world", seed: 1619, bots: 5, difficulty: "normal", maxTicks: 300 },
];

/** Same cadence as the browser: easy bots act every other second, expert bots twice per second. */
export function runBenchmarkMatch(scenario: BenchmarkScenario): BenchmarkResult {
  let state: GameState = createInitialGame(scenario.maxTicks, scenario.seed, scenario.presetId, scenario.bots);
  const actions = scenario.difficulty === "expert" ? 2 : 1;
  const cadence = scenario.difficulty === "easy" ? 2 : 1;
  while (!state.winner) {
    state = advanceGame(state);
    if (state.winner || state.tick % cadence !== 0) continue;
    for (const player of getMatchPlayers(state)) {
      if (!isPlayerAlive(state, player)) continue;
      for (let action = 0; action < actions; action++) {
        const command = chooseBotCommand(state, scenario.difficulty, player);
        if (!command) break;
        const result = applyCommand(state, command);
        if (!result.ok) break;
        state = result.state;
      }
      if (state.winner) break;
    }
  }
  const players = getMatchPlayers(state);
  return {
    scenario,
    winner: state.winner!,
    ticks: state.tick,
    decisive: state.tick < scenario.maxTicks,
    scores: Object.fromEntries(players.map((player) => [player, getControlScore(state, player)])),
    skillsLearned: Object.values(state.territories).reduce((sum, territory) => sum + (territory.skills?.length ?? 0), 0),
    territoriesClaimed: Object.values(state.territories).filter((territory) => territory.owner).length,
  };
}

export function formatBenchmark(results: BenchmarkResult[]): string {
  const rows = results.map((result) => [result.scenario.name, result.winner, `${result.ticks}s`, result.decisive ? "capital" : "clock", String(result.territoriesClaimed), String(result.skillsLearned)]);
  const header = ["Scenario", "Winner", "Length", "Ended by", "Claimed", "Skills"];
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => row[column].length)));
  const line = (cells: string[]) => cells.map((cell, column) => cell.padEnd(widths[column])).join("  ");
  return [line(header), line(widths.map((width) => "-".repeat(width))), ...rows.map(line)].join("\n");
}
