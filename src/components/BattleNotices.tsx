import { Swords } from "lucide-react";
import { getTerritory } from "../engine/map";
import { getPlayerName } from "../engine/players";
import type { BattleReport, MapDefinition } from "../engine/types";

interface Props { battles: BattleReport[]; map: MapDefinition; demoMode: boolean }

export function BattleNotices({ battles, map, demoMode }: Props) {
  return <div className="battle-notices" role="status" aria-live="polite" aria-relevant="additions text">
    {battles.map(battle => {
      const incoming = battle.defender === "human";
      const opponent = getPlayerName(incoming ? battle.attacker : battle.defender);
      const direction = incoming ? `${opponent} attacks ${demoMode ? "Blue" : "you"}` : `${demoMode ? "Blue attacks" : "You attack"} ${opponent}`;
      const result = battle.outcome === "approaching" ? "Fleet approaching" : battle.outcome === "repelled" ? "Attack repelled" : "Province captured";
      return <div className={incoming ? "battle-incoming" : "battle-outgoing"} key={`${battle.territory}-${battle.attacker}-${battle.defender}-${battle.outcome}`}>
        <Swords size={17} aria-hidden="true" />
        <span><strong>{direction}</strong><small>{getTerritory(map, battle.territory).label} · {result}</small></span>
      </div>;
    })}
  </div>;
}
