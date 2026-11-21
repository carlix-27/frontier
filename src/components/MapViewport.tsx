import { useEffect, useRef, useState, type PointerEvent } from "react";
import { playerBattles } from "../engine/battles";
import { BattleNotices } from "./BattleNotices";
import { GameMap } from "./GameMap";
import type { GameState, TerritoryId } from "../engine/types";

interface Props {
  game: GameState;
  demoMode: boolean;
  speed: 1 | 2 | 4;
  paused: boolean;
  selected: TerritoryId | null;
  resetToken: number;
  onTerritoryClick: (id: TerritoryId) => void;
  onTerritoryContextMenu: (id: TerritoryId, x: number, y: number) => void;
}

type View = { scale: number; x: number; y: number };
const INITIAL_VIEW: View = { scale: 1, x: 0, y: 0 };
const clampPan = (value: number, scale: number, size: number) => Math.min(0, Math.max(size * (1 - scale), value));

export function MapViewport({ game, demoMode, speed, paused, selected, resetToken, onTerritoryClick, onTerritoryContextMenu }: Props) {
  const battles = playerBattles(game, "human");
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; view: View; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { setView(INITIAL_VIEW); }, [resetToken, game.map]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      const px = event.clientX - bounds.left;
      const py = event.clientY - bounds.top;
      setView((current) => {
        const scale = Math.max(1, Math.min(4, current.scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15)));
        const ratio = scale / current.scale;
        return {
          scale,
          x: clampPan(px - (px - current.x) * ratio, scale, bounds.width),
          y: clampPan(py - (py - current.y) * ratio, scale, bounds.height),
        };
      });
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const bounds = element.getBoundingClientRect();
      setView((current) => ({ ...current, x: clampPan(current.x, current.scale, bounds.width), y: clampPan(current.y, current.scale, bounds.height) }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, view, moved: false };
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) event.currentTarget.setPointerCapture(event.pointerId);
    drag.moved = true;
    setDragging(true);
    const bounds = event.currentTarget.getBoundingClientRect();
    setView({ ...drag.view, x: clampPan(drag.view.x + dx, drag.view.scale, bounds.width), y: clampPan(drag.view.y + dy, drag.view.scale, bounds.height) });
  }

  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    suppressClickRef.current = drag.moved;
    if (drag.moved) window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    dragRef.current = null;
    setDragging(false);
  }

  return <>
    {!game.winner && <BattleNotices key={game.map.id} battles={battles} map={game.map} demoMode={demoMode} />}
    <div ref={viewportRef} className={`map-viewport${dragging ? " dragging" : ""}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
      <div className="map-viewport-content" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        <GameMap game={game} battles={battles} speed={speed} paused={paused} selected={selected} onTerritoryClick={(id) => { if (!suppressClickRef.current) onTerritoryClick(id); }} onTerritoryContextMenu={(id, x, y) => { if (!dragRef.current) onTerritoryContextMenu(id, x, y); }} />
      </div>
    </div>
  </>;
}
