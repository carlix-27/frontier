# Frontier

**A community-driven browser strategy game about territory, tactics, and shifting frontiers.**

Frontier is a PC-first browser strategy game. A short territorial match is the core experience; a future weekly campaign gives those matches a shared purpose. The project starts with a local player-versus-bot prototype so that the strategy loop is proven before online infrastructure is introduced.

## Play locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite. Use the map to select territories and issue commands.

## Current prototype

- One player versus one deterministic bot, or a local demonstration with two bots.
- Fifteen deterministic fictional maps: five classic continents and ten varied worlds with multiple countries separated by water, plus conquerable islands.
- Configurable [map generation](docs/map-generation.md): country, province and island counts, layout, roughness and seed.
- Expand, fortify, supply, and trade commands, plus province development.
- Maritime invasions with visible ships and supply connections back to the capital.
- Live match preview, adjustable game speed, and a fullscreen map with zoom and drag navigation.
- GitHub-inspired interface with Lucide icons, persistent light/dark themes, and a local player profile with photos and recent match results.
- Capital capture or control score win condition.
- Easy, normal, and expert bot behaviours.
- Pure TypeScript game rules and unit tests.

## Commands

- **Expand:** select a friendly territory, choose the force, then select an adjacent province or one linked by sea. Selecting an allied land province transfers troops along a dirt road instead of fighting it. Maritime attacks travel by ship.
- **Fortify:** select a friendly territory and spend units to increase its defence.
- **Supply:** select two adjacent friendly land territories to improve their road and increase production. Dirt roads appear automatically between neighboring allied provinces and give attacks from connected towns +1 combat power. Owned islands receive production while connected to your capital through owned provinces and sea links.
- **Trade:** connect two friendly territories to earn credits for buildings and population upgrades.

## Project direction

- [MVP definition](docs/product/mvp.md)
- [Architecture direction](docs/architecture.md)
- [Prioritized backlog](docs/backlog.md)

## Technology

The MVP uses Vite, React, TypeScript, SVG, `d3-delaunay`, and Vitest. Game rules live independently from reusable browser components so the same engine can later run on an authoritative multiplayer server.

Profile photos and match history are stored in the current browser only. Photos are resized before saving; there is no account or cloud sync yet.

## License

The source code is licensed under the [GNU Affero General Public License v3.0](LICENSE).

The `Frontier` name, logo, and future official art or audio assets are not granted for reuse merely by the source-code license. Forks must not present themselves as the official Frontier service.
