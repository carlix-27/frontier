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

- One player versus one deterministic bot.
- A deterministic, fictional continent generated from irregular Voronoi regions.
- Expand, fortify, and supply commands.
- Capital capture or control score win condition.
- Easy, normal, and expert bot behaviours.
- Pure TypeScript game rules and unit tests.

## Commands

- **Expand:** select a friendly territory, then an adjacent neutral or enemy territory. Half the units attack.
- **Fortify:** select a friendly territory and spend units to increase its defence.
- **Supply:** select two adjacent friendly territories to establish a route that increases production.

## Project direction

- [MVP definition](docs/product/mvp.md)
- [Architecture direction](docs/architecture.md)
- [Prioritized backlog](docs/backlog.md)

## Technology

The MVP uses Vite, React, TypeScript, SVG, `d3-delaunay`, and Vitest. Game rules live independently from reusable browser components so the same engine can later run on an authoritative multiplayer server.

## License

The source code is licensed under the [GNU Affero General Public License v3.0](LICENSE).

The `Frontier` name, logo, and future official art or audio assets are not granted for reuse merely by the source-code license. Forks must not present themselves as the official Frontier service.
