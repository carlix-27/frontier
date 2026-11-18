import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Factory, Handshake, House, LogOut, Shield, Ship, Swords, TrainFront, X, type LucideIcon } from "lucide-react";
import { chooseBotCommand, type BotDifficulty } from "./bots/basicBot";
import { GameMap } from "./components/GameMap";
import { GameOverScreen } from "./components/GameOverScreen";
import { MapViewport } from "./components/MapViewport";
import { MapPreview } from "./components/MapPreview";
import { PopulationPanel } from "./components/PopulationPanel";
import { ProfilePanel } from "./components/ProfilePanel";
import { ProvinceMenu } from "./components/ProvinceMenu";
import { SiteHeader } from "./components/SiteHeader";
import { advanceGame, applyCommand, buildingCost, BUILDING_COSTS, BUILDING_NAMES, createInitialGame, createRematch, getControlScore, getPopulation } from "./engine/game";
import { getMapPreset, getTerritory, MAP_PRESETS } from "./engine/map";
import { getMatchPlayers, getPlayerColor, getPlayerName, isPlayerAlive, MAX_BOTS } from "./engine/players";
import type { BuildingType, GameCommand, PlayerId, TerritoryId } from "./engine/types";
import { loadProfile, saveProfile } from "./profile";

type ActionMode = "expand" | "fortify" | "supply" | "trade";
type GameSpeed = 1 | 2 | 4;

const descriptions: Record<ActionMode, string> = {
  expand: "Attack a neighbor or move units to an ally along a road. A connected road adds 1 attack power.",
  fortify: "Spend 2 units to increase a territory's defence.",
  supply: "Open a route between adjacent friendly territories for faster growth.",
  trade: "Connect your ports or trade with an allied nation. Both countries earn credits on international routes.",
};
const commandIcons: Record<ActionMode, LucideIcon> = { expand: Swords, fortify: Shield, supply: ArrowRight, trade: Ship };

const buildingCards: Array<{ building: BuildingType; icon: ReactNode; description: string }> = [
  { building: "housing", icon: <House size={20} />, description: "+2 population every production cycle." },
  { building: "factory", icon: <Factory size={20} />, description: "+1 unit each cycle; adds a station for connected trains." },
  { building: "railway", icon: <TrainFront size={20} />, description: "+1 population each cycle; adds a station for connected trains." },
];

function defaultAttackForce(units: number): number { return Math.max(1, Math.min(3, units - 1)); }

export default function App() {
  const [game, setGame] = useState(() => createInitialGame());
  const [screen, setScreen] = useState<"home" | "setup" | "lobby" | "game" | "profile">("home");
  const [profileReturnScreen, setProfileReturnScreen] = useState<"home" | "game">("home");
  const [profile, setProfile] = useState(loadProfile);
  const [theme, setTheme] = useState<"light" | "dark">(() => { try { const saved = localStorage.getItem("frontier.theme"); if (saved === "light" || saved === "dark") return saved; } catch { /* Use system preference. */ } return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; });
  const [matchId, setMatchId] = useState(0);
  const [dismissedResultForMatch, setDismissedResultForMatch] = useState<number | null>(null);
  const [trackMatch, setTrackMatch] = useState(false);
  const recordedMatchRef = useRef(-1);
  const [mapChoice, setMapChoice] = useState<string>(MAP_PRESETS[0].id);
  const [duration, setDuration] = useState(300);
  const [managedTerritory, setManagedTerritory] = useState<TerritoryId | null>(null);
  const [contextMenu, setContextMenu] = useState<{ territory: TerritoryId; x: number; y: number } | null>(null);
  const [diplomacyNotice, setDiplomacyNotice] = useState<{ accepted: boolean; responder: PlayerId; reason: string; error?: boolean } | null>(null);
  const [mode, setMode] = useState<ActionMode>("expand");
  const [selected, setSelected] = useState<TerritoryId | null>(null);
  const [attackUnits, setAttackUnits] = useState<number | null>(null);
  const [buildingToPlace, setBuildingToPlace] = useState<BuildingType | null>(null);
  const [difficulty, setDifficulty] = useState<BotDifficulty>("normal");
  const [botCount, setBotCount] = useState(1);
  const [demoMode, setDemoMode] = useState(true);
  const [paused, setPaused] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [speed, setSpeed] = useState<GameSpeed>(1);
  const [hint, setHint] = useState("The two commanders are securing their capitals.");
  const [showGuide, setShowGuide] = useState(true);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const [mapResetToken, setMapResetToken] = useState(0);
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const scores = useMemo(() => ({
    human: getControlScore(game, "human"),
    botsAlive: getMatchPlayers(game).filter((player) => player !== "human" && isPlayerAlive(game, player)).length,
    population: getPopulation(game, "human"),
    credits: game.tradeCredits.human,
  }), [game]);

  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem("frontier.theme", theme); } catch { /* Keep the current appearance in memory. */ } }, [theme]);
  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => {
    if (!game.winner || !trackMatch || matchId === recordedMatchRef.current) return;
    recordedMatchRef.current = matchId;
    const result: "win" | "loss" | "draw" = game.winner === "draw" ? "draw" : game.winner === "human" ? "win" : "loss";
    const map = MAP_PRESETS.find((preset) => game.map.id.startsWith(`${preset.id}-`))?.name ?? "Unknown map";
    setProfile((current) => ({ ...current, history: [{ id: Date.now(), result, map, seconds: game.tick, playedAt: new Date().toISOString() }, ...current.history].slice(0, 20) }));
  }, [game.winner, game.tick, game.map.id, matchId, trackMatch]);

  function openProfile() { if (screen === "profile") return; setProfileReturnScreen(screen === "game" ? "game" : "home"); setScreen("profile"); }

  function activateMode(action: ActionMode) {
    setMode(action); setSelected(null); setAttackUnits(null); setBuildingToPlace(null);
    setHint(action === "fortify" ? "Select a friendly region to fortify." : action === "trade" ? "Select a friendly departure port." : "Select a friendly region to begin.");
  }

  useEffect(() => {
    const timer = window.setInterval(() => setGame((current) => {
      if ((screen !== "game" && screen !== "home") || (screen === "game" && (paused || confirmLeave)) || (screen === "home" && document.hidden) || current.winner) return current;
      let next = advanceGame(current);
      const cadence = difficulty === "easy" && screen !== "home" ? 2 : 1;
      if (!next.winner && next.tick % cadence === 0) {
        const commanders: PlayerId[] = getMatchPlayers(next).filter((player) => (player !== "human" || screen === "home" || demoMode) && isPlayerAlive(next, player));
        const actionsPerCommander = screen === "home" || demoMode ? 3 : difficulty === "expert" ? 2 : 1;
        for (const player of commanders) {
          for (let action = 0; action < actionsPerCommander; action += 1) {
            const command = chooseBotCommand(next, screen === "home" ? "normal" : difficulty, player);
            if (!command) break;
            const result = applyCommand(next, command);
            if (!result.ok) break;
            next = result.state;
          }
          if (next.winner) break;
        }
      }
      return next;
    }), screen === "home" ? 1000 : 1000 / speed);
    return () => window.clearInterval(timer);
  }, [confirmLeave, demoMode, difficulty, paused, screen, speed]);

  useEffect(() => {
    if (screen !== "home" || !game.winner) return;
    const timer = window.setTimeout(() => setGame(createInitialGame()), 3500);
    return () => window.clearTimeout(timer);
  }, [game.winner, screen]);

  useEffect(() => {
    const syncFullscreen = () => {
      const active = document.fullscreenElement === mapPanelRef.current;
      if (active) { setMapFullscreen(true); setFallbackFullscreen(false); }
      else if (!fallbackFullscreen) setMapFullscreen(false);
    };
    const exitFallback = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fallbackFullscreen) { setFallbackFullscreen(false); setMapFullscreen(false); }
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    window.addEventListener("keydown", exitFallback);
    return () => { document.removeEventListener("fullscreenchange", syncFullscreen); window.removeEventListener("keydown", exitFallback); };
  }, [fallbackFullscreen]);

  async function toggleMapFullscreen() {
    const panel = mapPanelRef.current;
    if (!panel) return;
    if (mapFullscreen) {
      if (document.fullscreenElement === panel) await document.exitFullscreen();
      setFallbackFullscreen(false); setMapFullscreen(false);
      return;
    }
    if (panel.requestFullscreen) {
      try { await panel.requestFullscreen(); setMapFullscreen(true); return; }
      catch { /* Use the in-page expanded view below. */ }
    }
    setFallbackFullscreen(true); setMapFullscreen(true);
  }

  useEffect(() => {
    const shortcuts: Record<string, ActionMode> = { "1": "expand", "2": "fortify", "3": "supply", "4": "trade" };
    function handleShortcut(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) return;
      if (screen !== "game" || confirmLeave || event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
      const action = shortcuts[event.key];
      if (!action) return;
      event.preventDefault(); activateMode(action);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [screen, confirmLeave]);

  useEffect(() => {
    if (!confirmLeave) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); setConfirmLeave(false); } };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [confirmLeave]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setContextMenu(null); };
    const closeOutside = (event: globalThis.PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest(".province-menu")) setContextMenu(null); };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOutside);
    return () => { window.removeEventListener("keydown", closeOnEscape); window.removeEventListener("pointerdown", closeOutside); };
  }, [contextMenu]);

  function submit(command: GameCommand) {
    const result = applyCommand(game, command);
    if (!result.ok) { setHint(result.reason); if (command.type === "ally") setDiplomacyNotice({ accepted: false, responder: command.with, reason: result.reason, error: true }); return false; }
    if (command.type === "ally" && result.state.events[0]?.diplomacy) setDiplomacyNotice(result.state.events[0].diplomacy);
    setGame(result.state); setSelected(null); setAttackUnits(null); setHint(result.state.events[0]?.message ?? "Command completed."); return true;
  }

  useEffect(() => { if (!diplomacyNotice) return; const timer = window.setTimeout(() => setDiplomacyNotice(null), 7000); return () => window.clearTimeout(timer); }, [diplomacyNotice]);
  useEffect(() => { setDiplomacyNotice(null); }, [matchId, screen]);

  function beginConstruction(building: BuildingType) {
    const cost = Math.min(...Object.values(game.territories).filter(t => t.owner === "human").map(t => buildingCost(t, building)));
    if (scores.credits < cost) { setHint(`You need ${cost} trade credits. Open routes and wait for deliveries.`); return; }
    setBuildingToPlace(building); setSelected(null); setHint(`Place ${BUILDING_NAMES[building]} in one of your territories.`);
  }

  function handleTerritory(id: TerritoryId) {
    if (game.winner) return;
    if (buildingToPlace) {
      if (submit({ type: "build", player: "human", territory: id, building: buildingToPlace })) { setBuildingToPlace(null); setHint("Construction complete. The city is growing."); }
      return;
    }
    if (mode === "fortify") { submit({ type: "fortify", player: "human", territory: id }); return; }
    if (!selected) {
      if (game.territories[id].owner !== "human") { setHint("Choose one of your own regions as the origin."); return; }
      setSelected(id); setAttackUnits(mode === "expand" ? defaultAttackForce(game.territories[id].units) : null); setHint(`Selected ${getTerritory(game.map, id).label}. ${mode === "trade" ? "Choose another friendly or allied port." : mode === "expand" ? "Set your force, then choose a neighboring province or linked island." : "Choose a neighboring region."}`); return;
    }
    if (mode === "expand") submit({ type: "expand", player: "human", from: selected, to: id, units: attackUnits ?? defaultAttackForce(game.territories[selected].units) });
    else if (mode === "supply") submit({ type: "supply", player: "human", from: selected, to: id });
    else submit({ type: "trade", player: "human", from: selected, to: id });
  }

  function manageTerritory(id: TerritoryId) {
    if (game.territories[id].owner !== "human") { setHint("You can manage population only in a blue territory."); return; }
    setManagedTerritory(id); setContextMenu(null); setHint(`Managing population in ${getTerritory(game.map, id).label}.`);
  }

  function openTerritoryMenu(territory: TerritoryId, x: number, y: number) {
    if (!game.territories[territory].owner) { setHint("Claim this province before opening its menu."); return; }
    setContextMenu({ territory, x: Math.max(8, Math.min(x, window.innerWidth - 290)), y: Math.max(8, Math.min(y, window.innerHeight - 215)) });
  }

  function tradeWithNation(target: TerritoryId) {
    const destination = getTerritory(game.map, target);
    const source = game.map.territories.filter((territory) => game.territories[territory.id].owner === "human").sort((first, second) => Math.hypot(first.x - destination.x, first.y - destination.y) - Math.hypot(second.x - destination.x, second.y - destination.y))[0];
    if (!source) { setHint("You need a province before opening a trade route."); return; }
    if (submit({ type: "trade", player: "human", from: source.id, to: target })) setContextMenu(null);
  }

  function startMatch(forceDemo = demoMode) {
    const preset = getMapPreset(mapChoice);
    setMatchId((id) => id + 1); setTrackMatch(!forceDemo);
    setDemoMode(forceDemo); setGame(createInitialGame(duration, preset.seed, preset.id, botCount)); setSelected(null); setAttackUnits(null); setBuildingToPlace(null); setManagedTerritory(null); setContextMenu(null); setPaused(false); setScreen("game");
    setHint(forceDemo ? `Blue and ${botCount} bot commanders are fighting. Right-click another nation for diplomacy.` : "Select a friendly region to begin. Right-click your land for population or another nation for diplomacy.");
  }

  function enterPreview() {
    setMatchId((id) => id + 1); setTrackMatch(false);
    setDemoMode(true); setPaused(false); setSpeed(1); setSelected(null); setManagedTerritory(null); setContextMenu(null);
    setHint("You joined the live local demo. Blue and red commanders are fighting.");
    setScreen("game");
  }

  function leaveFullscreen() {
    if (document.fullscreenElement === mapPanelRef.current) void document.exitFullscreen().catch(() => {});
    setFallbackFullscreen(false);
    setMapFullscreen(false);
  }

  function showMatchSetup() {
    leaveFullscreen();
    setContextMenu(null);
    setScreen("setup");
  }

  function replayMatch() {
    const opponents = getMatchPlayers(game).length - 1;
    setMatchId((id) => id + 1);
    setTrackMatch(!demoMode);
    setGame(createRematch(game));
    setSelected(null); setAttackUnits(null); setBuildingToPlace(null); setManagedTerritory(null); setContextMenu(null);
    setPaused(false); setSpeed(1); setMapResetToken((token) => token + 1); setShowGuide(true);
    setHint(demoMode ? `Blue and ${opponents} bot commanders are fighting.` : "Select a friendly region to begin. Right-click another nation for diplomacy.");
  }

  function returnHome() {
    leaveFullscreen();
    setConfirmLeave(false); setPaused(false); setSelected(null); setAttackUnits(null); setBuildingToPlace(null); setManagedTerritory(null); setContextMenu(null);
    setTrackMatch(false);
    setGame(createInitialGame()); setScreen("home");
  }

  const remaining = Math.max(0, game.maxTicks - game.tick);
  const selectedUnits = selected ? game.territories[selected].units : 0;
  const maxAttackUnits = Math.max(1, selectedUnits - 1);
  const committedUnits = selected ? Math.min(attackUnits ?? defaultAttackForce(selectedUnits), maxAttackUnits) : 0;
  const activeCommand = buildingToPlace ? BUILDING_NAMES[buildingToPlace] : mode;
  const activeKey = buildingToPlace ? null : (["expand", "fortify", "supply", "trade"] as ActionMode[]).indexOf(mode) + 1;
  const blueRegions = Object.values(game.territories).filter((territory) => territory.owner === "human").length;
  const players = getMatchPlayers(game);
  const blueAlive = isPlayerAlive(game, "human");
  const guideSteps = [
    { title: "Claim a neighboring province", detail: "Use Expand (1), choose a blue origin, set your force, then choose a neighbor.", done: blueRegions > 1 },
    { title: "Open a trade route", detail: "Trade between your provinces, or right-click another nation to ally and trade.", done: game.tradeRoutes.some((route) => route.player === "human") },
    { title: "Develop a province", detail: "Spend trade credits on housing, a factory, or a railway.", done: Object.values(game.territories).some((territory) => territory.owner === "human" && territory.buildings.some((building) => building !== "housing")) },
    { title: "Manage population", detail: "Right-click a blue province and choose Manage population for its skill tree.", done: Object.values(game.territories).some((territory) => territory.owner === "human" && ((territory.skills?.length ?? 0) > 0 || Object.values(territory.upgrades).some((level) => level > 0))) },
  ];
  const nextGuideStep = guideSteps.findIndex((step) => !step.done);
  const siteHeader = <SiteHeader theme={theme} profile={profile} onThemeChange={() => setTheme((current) => current === "dark" ? "light" : "dark")} onHome={returnHome} onCreate={showMatchSetup} onProfile={openProfile} />;
  if (screen === "profile") return <main className="app-shell profile-shell">{siteHeader}<ProfilePanel profile={profile} onChange={setProfile} onClose={() => setScreen(profileReturnScreen)} /></main>;
  if (screen !== "game") return <main className="app-shell lobby-shell">{siteHeader}<div className="home-hero"><p className="eyebrow">FRONTIER · LOCAL PROTOTYPE</p><h1>Frontier</h1><p className="subtitle">Create a continent. Command its future.</p></div>
    {screen === "home" ? <><button type="button" className="live-preview" onClick={enterPreview} aria-label="Open the live local bot match"><span className="live-preview-map"><GameMap game={game} speed={1} paused={false} selected={null} onTerritoryClick={() => {}} /></span><span className="live-preview-info"><span className="live-preview-label"><i /> LIVE LOCAL MATCH</span><strong>{game.winner ? "Match finished" : "A frontier is taking shape"}</strong><span>Blue AI {getControlScore(game, "human")} · Red AI {getControlScore(game, "bot")}</span><span>{game.winner ? "Open the final map" : `Match time ${String(Math.floor(game.tick / 60)).padStart(2, "0")}:${String(game.tick % 60).padStart(2, "0")}`}</span><b>Watch this match →</b></span></button><section className="lobby-card"><h2>Choose your next match</h2><p>Play against bots on one of {MAP_PRESETS.length} fictional worlds.</p><div className="lobby-actions"><button className="primary" onClick={() => setScreen("setup")}>Create match</button><button onClick={() => setScreen("lobby")}>Join local lobby</button></div><small>Online lobbies are planned; this prototype runs locally in your browser.</small></section></> : screen === "lobby" ? <section className="lobby-card"><h2>Local lobby</h2><p>A practice table is ready with the selected bot commanders. Join to watch their match.</p><div className="lobby-actions"><button onClick={returnHome}>Back</button><button className="primary" onClick={() => startMatch(true)}>Join practice match</button></div></section> : <section className="lobby-card"><h2>Create match</h2><p>Choose a map and rules before the clock starts.</p><div className="map-options">{MAP_PRESETS.map((preset) => <button key={preset.id} className={mapChoice === preset.id ? "map-option active" : "map-option"} onClick={() => setMapChoice(preset.id)}><strong>{preset.name}</strong><span>{preset.description}</span></button>)}</div><div className="setup-controls"><div className="match-options"><label>Duration<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={180}>3 minutes</option><option value={300}>5 minutes</option><option value={600}>10 minutes</option></select></label><label>Bot difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as BotDifficulty)}><option value="easy">Easy</option><option value="normal">Normal</option><option value="expert">Expert</option></select></label><label>Opponents<select aria-label="Number of bots" value={botCount} onChange={(event) => setBotCount(Number(event.target.value))}>{Array.from({ length: MAX_BOTS }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index === 0 ? "bot" : "bots"}</option>)}</select></label><label className="demo-toggle"><input type="checkbox" checked={demoMode} onChange={(event) => setDemoMode(event.target.checked)} />Blue auto-play (demo)</label></div><div className="lobby-actions setup-actions"><button onClick={returnHome}>Back</button><button className="primary" onClick={() => startMatch()}>Start match</button></div></div><MapPreview presetId={mapChoice} botCount={botCount} /></section>}
  </main>;
  return <main className="app-shell">{siteHeader}
    <header className="match-header">
      <div><p className="eyebrow">LOCAL REACT PROTOTYPE · GENERATED CONTINENT</p><h1>Frontier</h1><p className="subtitle">Every cell is land. Every city is a decision.</p></div>
      <div className="scoreboard"><div><span>{demoMode ? "Blue AI" : "You"}</span><strong>{scores.human}</strong></div><div><span>Bots alive</span><strong>{scores.botsAlive}/{players.length - 1}</strong></div><div><span>Population</span><strong>{scores.population.toLocaleString()}</strong></div><div><span>{game.winner ? "Match" : "Time"}</span><strong>{game.winner ? "Done" : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`}</strong></div></div>
    </header>
    <section className="game-layout">
      <div ref={mapPanelRef} className={`map-panel${fallbackFullscreen ? " map-expanded" : ""}`}>
        <div className="population-bar"><div><p className="eyebrow">POPULATION</p><strong>{scores.population.toLocaleString()}</strong><span>Unlimited citizens across your territories.</span></div><div className="trade-budget"><p className="eyebrow">TRADE CREDITS</p><strong>{scores.credits}</strong><span>Trade and local markets fund development.</span></div></div>
        <div className="playback-bar"><span>GAME SPEED</span><div className="speed-options" role="group" aria-label="Game speed">{([1, 2, 4] as GameSpeed[]).map((option) => <button key={option} type="button" className={speed === option ? "active" : ""} aria-pressed={speed === option} onClick={() => setSpeed(option)}>×{option}</button>)}</div><small className="map-help">Wheel to zoom · Drag to move</small><button type="button" onClick={() => setMapResetToken((token) => token + 1)} aria-label="Reset map view">Reset view</button><button type="button" className="fullscreen-button" onClick={toggleMapFullscreen} aria-pressed={mapFullscreen}>{mapFullscreen ? "Exit full screen" : "Full screen"}</button>{game.winner && dismissedResultForMatch === matchId && <button type="button" onClick={() => setDismissedResultForMatch(null)}>Match result</button>}<button type="button" className="leave-match-button" onClick={() => setConfirmLeave(true)}><LogOut size={15} /> Leave match</button><button type="button" className="pause-button" disabled={!!game.winner} onClick={() => setPaused((current) => !current)}>{game.winner ? "Finished" : paused ? "Resume" : "Pause"}</button></div>
        <div className="map-stage">{diplomacyNotice && <div className={`diplomacy-notice ${diplomacyNotice.accepted ? "accepted" : "rejected"}`} role="status" aria-live="polite"><Handshake size={22} /><div><strong>{diplomacyNotice.error ? "Proposal unavailable" : `${getPlayerName(diplomacyNotice.responder)} ${diplomacyNotice.accepted ? "accepted your alliance" : "declined your proposal"}`}</strong><span>{diplomacyNotice.reason}</span></div><button aria-label="Dismiss diplomacy notification" onClick={() => setDiplomacyNotice(null)}><X size={16} /></button></div>}<MapViewport game={game} speed={speed} paused={paused || confirmLeave || !!game.winner} selected={selected} resetToken={mapResetToken} onTerritoryClick={handleTerritory} onTerritoryContextMenu={openTerritoryMenu} /><div className="map-command-indicator" role="status" aria-live="polite"><span>ACTIVE COMMAND</span><strong>{activeCommand}</strong>{activeKey && <kbd>{activeKey}</kbd>}</div><div className="map-players" aria-label="Players alive"><span>PLAYERS ALIVE</span>{players.map((player) => { const alive = isPlayerAlive(game, player); return <strong key={player} className={alive ? "alive" : ""}><i className="player-swatch" style={{ backgroundColor: getPlayerColor(player) }} />{player === "human" ? demoMode ? "Blue AI" : "You" : `${getPlayerName(player)} AI`}{alive ? "" : " · out"}</strong>; })}</div></div>
        {managedTerritory && mapFullscreen && <div className="population-floating"><PopulationPanel game={game} territoryId={managedTerritory} onCommand={submit} onClose={() => setManagedTerritory(null)} /></div>}
        {contextMenu && <ProvinceMenu game={game} territoryId={contextMenu.territory} x={contextMenu.x} y={contextMenu.y} onManage={() => manageTerritory(contextMenu.territory)} onAlly={() => { const owner = game.territories[contextMenu.territory].owner; if (owner) { submit({ type: "ally", player: "human", with: owner }); setContextMenu(null); } }} onEndAlliance={() => { const owner = game.territories[contextMenu.territory].owner; if (owner && submit({ type: "endAlliance", player: "human", with: owner })) setContextMenu(null); }} onTrade={() => tradeWithNation(contextMenu.territory)} onClose={() => setContextMenu(null)} />}
        {showGuide ? <section className="match-guide" aria-label="Optional match guide"><div className="guide-header"><div><span>FIELD GUIDE · OPTIONAL</span><strong>{game.winner ? "Match complete" : nextGuideStep < 0 ? "Explore your own strategy" : `Suggested step ${nextGuideStep + 1} of ${guideSteps.length}`}</strong></div><button onClick={() => setShowGuide(false)} aria-label="Hide guide">Hide ×</button></div><p role="status">{game.winner ? (game.winner === "draw" ? "Draw. The frontier remains contested." : `${getPlayerName(game.winner)} controls the frontier.`) : !blueAlive && !demoMode ? "Your capital fell. You can watch the remaining bots." : hint}</p><ol>{guideSteps.map((step, index) => <li key={step.title} className={step.done ? "done" : index === nextGuideStep ? "current" : ""}><span>{step.done ? "✓" : index + 1}</span><div><strong>{step.title}</strong>{index === nextGuideStep && <small>{step.detail}</small>}</div></li>)}</ol></section> : <button className="guide-reopen" onClick={() => setShowGuide(true)}>Show field guide</button>}
        {confirmLeave && <div className="game-over-overlay"><div className="leave-match-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-match-title" aria-describedby="leave-match-description" onKeyDown={(event) => { if (event.key !== "Tab") return; const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button"); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); } }}><div className="leave-match-icon"><LogOut size={22} /></div><h2 id="leave-match-title">Leave this match?</h2><p id="leave-match-description">Your current match will be lost. You can create a new one from the main menu.</p><div className="leave-match-actions"><button type="button" autoFocus onClick={() => setConfirmLeave(false)}>Keep playing</button><button type="button" className="leave-match-confirm" onClick={returnHome}>Leave match</button></div></div></div>}
        {game.winner && dismissedResultForMatch !== matchId && !confirmLeave && <GameOverScreen game={game} demoMode={demoMode} onReplay={replayMatch} onCreate={showMatchSetup} onHome={returnHome} onViewMap={() => setDismissedResultForMatch(matchId)} />}
      </div>
      <aside className="control-panel">
        {managedTerritory && !mapFullscreen && <PopulationPanel game={game} territoryId={managedTerritory} onCommand={submit} onClose={() => setManagedTerritory(null)} />}
        <div className="construction-menu"><p className="eyebrow">TRADE & DEVELOPMENT</p><p className="description">Trade routes fund permanent infrastructure. Click a project, then choose a friendly territory.</p>{buildingCards.map((card) => <button key={card.building} className={buildingToPlace === card.building ? "building-card active" : "building-card"} disabled={!Object.values(game.territories).some(t => t.owner === "human" && scores.credits >= buildingCost(t, card.building))} onClick={() => beginConstruction(card.building)}><b>{card.icon}</b><span><strong>{BUILDING_NAMES[card.building]} · {BUILDING_COSTS[card.building]} credits (before local discounts)</strong><small>{card.description}</small></span></button>)}</div>
        <div><p className="eyebrow">COMMAND</p><div className="actions">{(["expand", "fortify", "supply", "trade"] as ActionMode[]).map((action, index) => { const Icon = commandIcons[action]; return <button key={action} className={mode === action && !buildingToPlace ? "active" : ""} onClick={() => activateMode(action)}><span><Icon size={16} />{action}</span><kbd>{index + 1}</kbd></button>; })}</div><p className="description">{descriptions[mode]}</p>{mode === "expand" && selected && <div className="force-control"><div><p className="eyebrow">ATTACK FORCE</p><strong>{committedUnits} units</strong><span>{selectedUnits - committedUnits} remain defending {getTerritory(game.map, selected).label}.</span></div><input aria-label="Attack force" type="range" min="1" max={maxAttackUnits} value={committedUnits} onChange={(event) => setAttackUnits(Number(event.target.value))} /><div className="force-presets"><button type="button" onClick={() => setAttackUnits(1)}>1</button><button type="button" onClick={() => setAttackUnits(Math.max(1, Math.floor(maxAttackUnits / 2)))}>Half</button><button type="button" onClick={() => setAttackUnits(maxAttackUnits)}>Max</button></div></div>}</div>
        <label>Bot difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as BotDifficulty)}><option value="easy">Easy</option><option value="normal">Normal</option><option value="expert">Expert</option></select></label>
        <label className="demo-toggle"><input type="checkbox" checked={demoMode} onChange={(event) => { setDemoMode(event.target.checked); if (event.target.checked) setTrackMatch(false); setSelected(null); setBuildingToPlace(null); setHint(event.target.checked ? "Demo enabled. Blue and red commanders are fighting." : "Demo disabled. Blue is under your command."); }} />Auto-play blue (demo)</label>
        <div className="controls"><button className="primary" onClick={showMatchSetup}>Create match</button></div>
        <div className="log"><p className="eyebrow">BATTLE LOG</p>{game.events.map((event, index) => <p key={`${event.tick}-${index}`}><span>{event.tick}s</span>{event.message}</p>)}</div>
      </aside>
    </section>
  </main>;
}
