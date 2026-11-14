import "./style.css";
import { chooseBotCommand, type BotDifficulty } from "./bots/basicBot";
import { advanceGame, applyCommand, createInitialGame, getControlScore } from "./engine/game";
import { linkId, territoryDefinitions, territoriesById } from "./engine/map";
import type { GameCommand, GameState, TerritoryId } from "./engine/types";

type ActionMode = "expand" | "fortify" | "supply";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root is missing.");

app.innerHTML = `
  <section class="shell">
    <header class="masthead">
      <div>
        <p class="eyebrow">LOCAL PROTOTYPE · PC BROWSER</p>
        <h1>Frontier</h1>
        <p class="subtitle">Take territory. Protect your supply lines. Break the enemy capital.</p>
      </div>
      <div class="scoreboard" aria-label="Control score">
        <div><span>You</span><strong id="human-score">0</strong></div>
        <div><span>Bot</span><strong id="bot-score">0</strong></div>
        <div><span>Time</span><strong id="timer">05:00</strong></div>
      </div>
    </header>
    <section class="game-layout">
      <div class="map-panel">
        <canvas id="map" width="960" height="600" aria-label="Frontier territory map"></canvas>
        <p id="hint" class="hint" aria-live="polite">Select one of your territories to begin.</p>
      </div>
      <aside class="control-panel">
        <div>
          <p class="eyebrow">COMMAND</p>
          <div class="actions" role="group" aria-label="Command type">
            <button class="command active" data-action="expand" type="button">Expand</button>
            <button class="command" data-action="fortify" type="button">Fortify</button>
            <button class="command" data-action="supply" type="button">Supply</button>
          </div>
          <p id="command-description" class="description">Send half your units into an adjacent neutral or enemy territory.</p>
        </div>
        <label class="difficulty-label" for="difficulty">Bot difficulty
          <select id="difficulty">
            <option value="easy">Easy</option>
            <option value="normal" selected>Normal</option>
            <option value="expert">Expert</option>
          </select>
        </label>
        <div class="controls">
          <button id="pause" type="button">Pause</button>
          <button id="restart" type="button" class="primary">New match</button>
        </div>
        <div class="legend" aria-label="Map legend">
          <span><i class="dot human"></i>You</span>
          <span><i class="dot neutral"></i>Neutral</span>
          <span><i class="dot bot"></i>Bot</span>
          <span><i class="line"></i>Supply route</span>
        </div>
        <div class="log-wrap">
          <p class="eyebrow">BATTLE LOG</p>
          <ol id="events" class="events"></ol>
        </div>
      </aside>
    </section>
  </section>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#map")!;
const scoreHuman = document.querySelector<HTMLElement>("#human-score")!;
const scoreBot = document.querySelector<HTMLElement>("#bot-score")!;
const timer = document.querySelector<HTMLElement>("#timer")!;
const hint = document.querySelector<HTMLElement>("#hint")!;
const eventList = document.querySelector<HTMLOListElement>("#events")!;
const difficultySelect = document.querySelector<HTMLSelectElement>("#difficulty")!;
const pauseButton = document.querySelector<HTMLButtonElement>("#pause")!;
const restartButton = document.querySelector<HTMLButtonElement>("#restart")!;
const commandDescription = document.querySelector<HTMLElement>("#command-description")!;
const context = canvas.getContext("2d")!;

const descriptions: Record<ActionMode, string> = {
  expand: "Send half your units into an adjacent neutral or enemy territory.",
  fortify: "Spend 2 units to strengthen a friendly territory. Select one territory.",
  supply: "Open a route between adjacent friendly territories. It improves production."
};

let game = createInitialGame();
let mode: ActionMode = "expand";
let selected: TerritoryId | null = null;
let paused = false;

function ownerColor(owner: GameState["territories"][TerritoryId]["owner"]): string {
  if (owner === "human") return "#4cc9f0";
  if (owner === "bot") return "#ff5d8f";
  return "#5a6878";
}

function drawMap(): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0d1726";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const territory of territoryDefinitions) {
    for (const neighbourId of territory.neighbours) {
      if (territory.id > neighbourId) continue;
      const neighbour = territoriesById[neighbourId];
      const supplied = game.suppliedLinks.includes(linkId(territory.id, neighbourId));
      context.beginPath();
      context.moveTo(territory.x, territory.y);
      context.lineTo(neighbour.x, neighbour.y);
      context.strokeStyle = supplied ? "#ffd166" : "#2b3c50";
      context.lineWidth = supplied ? 6 : 3;
      context.stroke();
    }
  }

  for (const territory of territoryDefinitions) {
    const state = game.territories[territory.id];
    const isSelected = selected === territory.id;
    context.beginPath();
    context.arc(territory.x, territory.y, territory.capital ? 42 : 34, 0, Math.PI * 2);
    context.fillStyle = ownerColor(state.owner);
    context.globalAlpha = state.owner ? 0.88 : 0.55;
    context.fill();
    context.globalAlpha = 1;
    context.lineWidth = isSelected ? 5 : 2;
    context.strokeStyle = isSelected ? "#ffffff" : "#152232";
    context.stroke();
    if (state.fortification > 0) {
      context.beginPath();
      context.arc(territory.x, territory.y, territory.capital ? 35 : 27, 0, Math.PI * 2);
      context.strokeStyle = "#ffd166";
      context.lineWidth = 2 + state.fortification;
      context.stroke();
    }
    context.fillStyle = "#f7fbff";
    context.font = "600 15px system-ui";
    context.textAlign = "center";
    context.fillText(territory.label, territory.x, territory.y - 5);
    context.font = "700 21px system-ui";
    context.fillText(String(state.units), territory.x, territory.y + 20);
  }
}

function updateHud(): void {
  scoreHuman.textContent = String(getControlScore(game, "human"));
  scoreBot.textContent = String(getControlScore(game, "bot"));
  const remaining = Math.max(0, game.maxTicks - game.tick);
  timer.textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  eventList.innerHTML = game.events.map((event) => `<li><span>${event.tick}s</span>${event.message}</li>`).join("");
  if (game.winner) {
    hint.textContent = game.winner === "draw" ? "Draw. Start a new match to fight again." : game.winner === "human" ? "Victory. The frontier is yours." : "Defeat. Review the log and try a new approach.";
  }
  drawMap();
}

function setHint(message: string): void {
  hint.textContent = message;
}

function submit(command: GameCommand): void {
  const result = applyCommand(game, command);
  if (!result.ok) {
    setHint(result.reason);
    return;
  }
  game = result.state;
  selected = null;
  setHint("Command executed. Watch the frontier closely.");
  updateHud();
}

function selectTerritory(id: TerritoryId): void {
  if (game.winner) return;
  const territory = game.territories[id];
  if (mode === "fortify") {
    submit({ type: "fortify", player: "human", territory: id });
    return;
  }
  if (!selected) {
    if (territory.owner !== "human") {
      setHint("Select one of your territories as the command origin.");
      return;
    }
    selected = id;
    setHint(`Selected ${territoriesById[id].label}. Now select an adjacent target.`);
    updateHud();
    return;
  }
  submit(mode === "expand" ? { type: "expand", player: "human", from: selected, to: id } : { type: "supply", player: "human", from: selected, to: id });
}

canvas.addEventListener("click", (event) => {
  const bounds = canvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * (canvas.width / bounds.width);
  const y = (event.clientY - bounds.top) * (canvas.height / bounds.height);
  const hit = territoryDefinitions.find((territory) => Math.hypot(territory.x - x, territory.y - y) <= (territory.capital ? 44 : 36));
  if (hit) selectTerritory(hit.id);
});

document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    mode = button.dataset.action as ActionMode;
    selected = null;
    document.querySelectorAll("[data-action]").forEach((control) => control.classList.toggle("active", control === button));
    commandDescription.textContent = descriptions[mode];
    setHint(mode === "fortify" ? "Select a friendly territory to fortify." : "Select one of your territories to begin.");
    updateHud();
  });
});

pauseButton.addEventListener("click", () => {
  paused = !paused;
  pauseButton.textContent = paused ? "Resume" : "Pause";
});

restartButton.addEventListener("click", () => {
  game = createInitialGame();
  selected = null;
  paused = false;
  pauseButton.textContent = "Pause";
  setHint("New match. Select one of your territories to begin.");
  updateHud();
});

window.setInterval(() => {
  if (paused || game.winner) return;
  game = advanceGame(game);
  const difficulty = difficultySelect.value as BotDifficulty;
  const cadence = difficulty === "easy" ? 5 : difficulty === "normal" ? 3 : 2;
  if (!game.winner && game.tick % cadence === 0) {
    const command = chooseBotCommand(game, difficulty);
    if (command) {
      const result = applyCommand(game, command);
      if (result.ok) game = result.state;
    }
  }
  updateHud();
}, 1000);

updateHud();
