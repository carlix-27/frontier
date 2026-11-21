import { describe, expect, it } from "vitest";
import { advanceGame, applyCommand, createInitialGame } from "./game";
import { BATTLE_REPORT_TICKS, playerBattles } from "./battles";
import type { PlayerId } from "./types";

function skirmish(sea: boolean, attacker: PlayerId, defender: PlayerId | null, units: number) {
  const game = createInitialGame(300, 27, "crownlands", 2);
  const from = game.map.territories.find(t => !t.capitalFor && (sea ? t.seaNeighbours : t.neighbours).some(id => !game.map.territories.find(p => p.id === id)?.capitalFor))!;
  const to = (sea ? from.seaNeighbours : from.neighbours).find(id => !game.map.territories.find(p => p.id === id)?.capitalFor)!;
  game.territories[from.id] = { ...game.territories[from.id], owner: attacker, units: 20 };
  game.territories[to] = { ...game.territories[to], owner: defender, units: 7 };
  const result = applyCommand(game, { type: "expand", player: attacker, from: from.id, to, units });
  if (!result.ok) throw new Error(result.reason);
  return { state: result.state, to };
}

describe("personal battle reports", () => {
  it("remembers the defender after capture and expires on the simulation clock", () => {
    const { state, to } = skirmish(false, "bot", "human", 18);
    expect(state.territories[to].owner).toBe("bot");
    expect(playerBattles(state, "human")).toMatchObject([{ attacker: "bot", defender: "human", territory: to, outcome: "captured" }]);
    let later = state;
    for (let i = 0; i < BATTLE_REPORT_TICKS; i++) later = advanceGame(later);
    expect(playerBattles(later, "human")).toEqual([]);
  });
  it("shows an outgoing sea attack before landing and reports a repelled landing", () => {
    const { state } = skirmish(true, "human", "bot", 1);
    expect(playerBattles(state, "human")).toMatchObject([{ outcome: "approaching" }]);
    expect(playerBattles(advanceGame(advanceGame(advanceGame(state))), "human")).toMatchObject([{ attacker: "human", defender: "bot", outcome: "repelled" }]);
  });
  it("ignores neutral expansion, reinforcements, and wars between other nations", () => {
    for (const sea of [true, false]) {
      for (const [attacker, defender] of [["human", null], ["human", "human"], ["bot", "bot-2"]] as const) {
        const { state } = skirmish(sea, attacker, defender, 2);
        expect(playerBattles(state, "human")).toEqual([]);
        expect(playerBattles(advanceGame(state), "human")).toEqual([]);
      }
    }
  });
});
