import { describe, expect, it } from "vitest";
import { chooseBotCommand } from "../bots/basicBot";
import { advanceGame, applyCommand, createInitialGame } from "./game";
import { isCoastal } from "./navigation";
import { activeTradeRoute } from "./trade";

function tradingPartners() {
  const game = createInitialGame();
  const from = game.map.territories.find(t => t.capitalFor === "human")!.id;
  const to = game.map.territories.find(t => t.capitalFor === "bot")!.id;
  game.alliances = ["bot:human"];
  return { game, from, to };
}

describe("foreign maritime trade", () => {
  it("requires an alliance and two coastal endpoints", () => {
    const { game, from, to } = tradingPartners();
    const inland = game.map.territories.find(t => !isCoastal(game.map, t.id))!.id;
    game.territories[inland].owner = "bot";
    expect(applyCommand(game, { type: "trade", player: "human", from, to: inland }).ok).toBe(false);
    expect(applyCommand({ ...game, alliances: [] }, { type: "trade", player: "human", from, to }).ok).toBe(false);
    expect(applyCommand(game, { type: "trade", player: "human", from, to }).ok).toBe(true);
  });
  it("prevents reverse duplicates and rewards both countries", () => {
    const { game, from, to } = tradingPartners();
    const opened = applyCommand(game, { type: "trade", player: "human", from, to }).state;
    expect(opened.tradeRoutes).toHaveLength(1);
    expect(applyCommand(opened, { type: "trade", player: "bot", from: to, to: from }).ok).toBe(false);
    const delivered = advanceGame({ ...opened, tick: 2 });
    expect(delivered.tradeCredits.human).toBe(2);
    expect(delivered.tradeCredits.bot).toBe(2);
  });
  it("removes legacy domestic routes before paying or displaying them", () => {
    const { game, from } = tradingPartners();
    const to = game.map.territories.find(t => t.island)!.id;
    game.territories[to].owner = "human";
    const route = { id: [from, to].sort().join(":"), from, to, player: "human" as const, recipient: "human" as const };
    game.tradeRoutes = [route];
    expect(activeTradeRoute(game, route)).toBe(false);
    const next = advanceGame({ ...game, tick: 2 });
    expect(next.tradeRoutes).toHaveLength(0);
    expect(next.tradeCredits.human).toBe(0);
  });
  it("lets a bot open a foreign route only with an ally", () => {
    const { game, from, to } = tradingPartners();
    for (const province of Object.values(game.territories)) province.units = 1;
    game.tick = 1;
    expect(chooseBotCommand(game, "normal", "bot")).toMatchObject({ type: "trade", from: to, to: from });
    expect(chooseBotCommand({ ...game, alliances: [] }, "normal", "bot")?.type).not.toBe("trade");
  });
});
