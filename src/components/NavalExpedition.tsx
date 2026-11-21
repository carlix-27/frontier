import { useLayoutEffect, useRef } from "react";
import { getPlayerColor } from "../engine/players";
import type { SeaInvasion, TerritoryDefinition } from "../engine/types";

interface Props {
  ship: SeaInvasion;
  from: TerritoryDefinition;
  to: TerritoryDefinition;
  speed: number;
  tick: number;
}

export function NavalExpedition({ ship, from, to, speed, tick }: Props) {
  const motionRef = useRef<SVGAnimateMotionElement>(null);
  const travelTicks = ship.arrivalTick - (ship.launchedTick ?? ship.arrivalTick - 1);
  const initialProgress = Math.max(0, Math.min(1, (tick - (ship.launchedTick ?? tick)) / travelTicks));
  const clock = useRef({ time: 0, progress: initialProgress, speed, started: false });
  const path = `M${from.x},${from.y} Q${(from.x + to.x) / 2},${(from.y + to.y) / 2 - 16} ${to.x},${to.y}`;

  useLayoutEffect(() => {
    const motion = motionRef.current;
    const svg = motion?.ownerSVGElement;
    if (!motion || !svg) return;
    const now = svg.getCurrentTime();
    const previous = clock.current;
    const elapsed = previous.started ? (now - previous.time) * previous.speed / travelTicks : 0;
    const progress = Math.min(1, previous.progress + elapsed);
    clock.current = { time: now, progress, speed, started: true };
    motion.setAttribute("keyPoints", `${progress};1`);
    motion.setAttribute("dur", `${Math.max(.01, (1 - progress) * travelTicks / speed)}s`);
    // Start at this vessel's departure, not at the SVG's global time zero.
    motion.beginElement();
  }, [speed, travelTicks]);

  return <g className="invasion-ship">
    <title>{`${ship.units} troops sailing from ${from.label} to ${to.label}`}</title>
    <path d={path} className="invasion-wake expedition-route" style={{ animationDuration: `${2 / speed}s` }} />
    <circle cx={to.x} cy={to.y} r="16" className="expedition-landing" style={{ animationDuration: `${1.5 / speed}s` }} />
    <g className="invasion-vessel">
      <animateMotion ref={motionRef} path={path} begin="indefinite" keyTimes="0;1" calcMode="linear" fill="freeze" rotate="auto" />
      <path d="M-14,4 Q-20,2 -25,4 M-16,7 Q-22,6 -29,7" className="vessel-wake" />
      <path d="M-10,2 L10,2 L6,8 L-6,8 Z" className="invasion-hull" style={{ fill: getPlayerColor(ship.player) }} />
      <path d="M-1,1 V-12 L7,-3 H-1" className="invasion-sail" />
      <rect x="-6" y="-4" width="4" height="6" />
    </g>
  </g>;
}
