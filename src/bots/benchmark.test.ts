import { describe, expect, it } from "vitest";
import { BENCHMARK_SCENARIOS, formatBenchmark, runBenchmarkMatch } from "./benchmark";

describe("bot benchmark scenarios", () => {
  it("plays every scenario to a deterministic result", () => {
    const results = BENCHMARK_SCENARIOS.map(runBenchmarkMatch);
    // `npm run benchmark` prints the table; `npm test` stays quiet.
    if (import.meta.env?.MODE === "benchmark") console.log(`\n${formatBenchmark(results)}\n`);
    for (const result of results) {
      expect(result.ticks).toBeLessThanOrEqual(result.scenario.maxTicks);
      // Bots should expand and develop, not sit still.
      expect(result.territoriesClaimed).toBeGreaterThan(result.scenario.bots + 1);
      expect(result.skillsLearned).toBeGreaterThan(0);
    }
    expect(runBenchmarkMatch(BENCHMARK_SCENARIOS[1])).toEqual(results[1]);
  });
});
