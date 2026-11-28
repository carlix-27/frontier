import { Flag, Handshake, Ship, UsersRound, X } from "lucide-react";
import { areAllied } from "../engine/diplomacy";
import { isCoastal } from "../engine/navigation";
import { activeTradeRoute } from "../engine/trade";
import { getTerritory } from "../engine/map";
import { getPlayerColor, getPlayerName, isPlayerAlive } from "../engine/players";
import { TERRAINS } from "../engine/terrain";
import type { GameState, TerritoryId } from "../engine/types";

interface Props {
  game: GameState;
  territoryId: TerritoryId;
  x: number;
  y: number;
  onManage: () => void;
  onAlly: () => void;
  onEndAlliance: () => void;
  onTrade: () => void;
  onClose: () => void;
}

export function ProvinceMenu({ game, territoryId, x, y, onManage, onAlly, onEndAlliance, onTrade, onClose }: Props) {
  const territory = getTerritory(game.map, territoryId);
  const owner = game.territories[territoryId].owner;
  const allied = owner && owner !== "human" && areAllied(game, "human", owner);
  const active = owner && isPlayerAlive(game, owner);
  const pending = owner && (game.pendingAlliances ?? []).some(p => (p.proposer === "human" && p.responder === owner) || (p.responder === "human" && p.proposer === owner));
  const coastal = isCoastal(game.map, territoryId);
  const trading = game.tradeRoutes.some(route => (route.player === "human" || route.recipient === "human") &&
    (route.from === territoryId || route.to === territoryId) && activeTradeRoute(game, route));

  return <div className="province-menu" role="menu" aria-label={`${territory.label} actions`} style={{ left: x, top: y }}>
    <div className="province-menu-heading"><Flag size={18} strokeWidth={2.3} style={{ color: getPlayerColor(owner) }} /><div><strong>{territory.label}</strong><small>{owner === "human" ? "Your province" : owner ? `${getPlayerName(owner)} nation${allied ? " · Allied" : ""}` : "Unclaimed province"}{territory.terrain ? ` · ${TERRAINS[territory.terrain].name}` : ""}</small></div><button type="button" className="province-menu-dismiss" aria-label="Close menu" onClick={onClose}><X size={16} /></button></div>
    {owner === "human" ? <button type="button" className="province-menu-action" role="menuitem" onClick={onManage}><UsersRound size={20} strokeWidth={2.4} /><span><strong>Manage population</strong><small>{game.territories[territoryId].researchGoal ? "Research plan in progress" : "Open this province's skill tree"}</small></span></button> : owner ? <>
      {allied ? <button type="button" className="province-menu-action" role="menuitem" onClick={onEndAlliance} disabled={!active || !!game.winner}><Handshake size={20} strokeWidth={2.4} /><span><strong>End alliance</strong><small>Trade routes will close</small></span></button> : <button type="button" className="province-menu-action" role="menuitem" onClick={onAlly} disabled={!active || !!game.winner || !isPlayerAlive(game, "human") || !!pending}><Handshake size={20} strokeWidth={2.4} /><span><strong>{pending ? "Proposal pending" : "Propose alliance"}</strong><small>{pending ? "Awaiting a response" : "The nation may accept or decline"}</small></span></button>}
      <button type="button" className="province-menu-action" role="menuitem" onClick={onTrade} disabled={!coastal || !allied || !active || !isPlayerAlive(game, "human") || trading || !!game.winner}><Ship size={20} strokeWidth={2.4} /><span><strong>{trading ? "Trade route active" : "Trade with this nation"}</strong><small>{!coastal ? "Trading ships need a coastal destination" : allied ? "Both nations earn credits from trading ships" : "Establish an alliance first"}</small></span></button>
    </> : null}
  </div>;
}
