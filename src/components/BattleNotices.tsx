import { Swords } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getTerritory } from "../engine/map";
import { getPlayerName } from "../engine/players";
import type { BattleReport, MapDefinition } from "../engine/types";

interface Props { battles: BattleReport[]; map: MapDefinition; demoMode: boolean }

function frontKey(battle: BattleReport) {
  return `${battle.territory}:${battle.attacker}:${battle.defender}`;
}

function noticeKey(battle: BattleReport) {
  return `${frontKey(battle)}:${battle.outcome}:${battle.tick}`;
}

export function BattleNotices({ battles, map, demoMode }: Props) {
  const seen = useRef(new Set<string>());
  const [notices, setNotices] = useState<BattleReport[]>([]);

  useEffect(() => {
    const fresh = battles.filter(battle => !seen.current.has(noticeKey(battle)));
    seen.current = new Set(battles.map(noticeKey));
    if (!fresh.length) return;

    // Only the newest message per front stays on screen, including when a fleet lands.
    setNotices(previous => {
      const fronts = new Set<string>();
      return [...fresh, ...previous].filter(battle => {
        const key = frontKey(battle);
        if (fronts.has(key)) return false;
        fronts.add(key);
        return true;
      });
    });
  }, [battles]);

  return <div className="battle-notices" role="status" aria-live="polite" aria-relevant="additions text">
    {notices.map(battle => {
      const incoming = battle.defender === "human";
      const opponent = getPlayerName(incoming ? battle.attacker : battle.defender);
      const direction = incoming ? `${opponent} attacks ${demoMode ? "Blue" : "you"}` : `${demoMode ? "Blue attacks" : "You attack"} ${opponent}`;
      const result = battle.outcome === "approaching" ? "Fleet approaching" : battle.outcome === "repelled" ? "Attack repelled" : "Province captured";
      const id = noticeKey(battle);
      return <div className={incoming ? "battle-incoming" : "battle-outgoing"} key={id}
        onAnimationEnd={() => setNotices(current => current.filter(item => noticeKey(item) !== id))}>
        <Swords size={17} aria-hidden="true" />
        <span><strong>{direction}</strong><small>{getTerritory(map, battle.territory).label} · {result}</small></span>
      </div>;
    })}
  </div>;
}
