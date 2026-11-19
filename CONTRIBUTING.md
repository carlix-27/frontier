# Contributing to Frontier

Thanks for helping build Frontier. This guide covers the local setup, how the code is organised, and what a good change looks like.

## Setup

Requirements: a current Node.js LTS release (22 or newer recommended).

```bash
npm install
npm run dev        # local game at the URL Vite prints
npm test           # all unit tests
npm run build      # TypeScript check + production build
npm run benchmark  # bot-versus-bot balance scenarios
```

## Where things live

```text
src/engine/        Pure, deterministic game rules: map generation, terrain, commands, production, combat, population skills
src/bots/          Bot decisions (public engine commands only) and the headless benchmark
src/components/    React components: map, preview, menus, skill tree, profile
src/App.tsx        Screens and local match orchestration
docs/              Product direction, rules and design notes
```

## Rules of the engine

- **Deterministic.** No `Math.random`, wall clock, DOM or network inside `src/engine/`. Randomness comes from seeded generators, so a seed and command log can replay a match.
- **Immutable commands.** `applyCommand(state, command)` returns a new state or `{ ok: false, reason }` with the original state untouched. Reasons are shown to players, so write them as plain sentences.
- **Same rules for everyone.** Bots use the same commands and costs as the player. No hidden bonuses.
- **Data over code.** New map presets go in `src/engine/mapPresets.ts`; skills in `POPULATION_SKILLS`; terrain in `src/engine/terrain.ts`. The interface reads these catalogs instead of duplicating rules.

## Making a change

1. Open or pick an issue; the [backlog](docs/backlog.md) shows priorities.
2. Keep pull requests focused. Use conventional commit titles: `feat(engine): …`, `fix(client): …`, `docs: …`, `test: …`, `balance: …`.
3. Add or update tests for every rule change. Map changes should keep the invariants in `mapGenerator.test.ts` (exact counts, geometry, symmetric adjacency, reachability).
4. For balance changes, run `npm run benchmark` before and after and include both tables in the pull request.
5. For interface changes, check light and dark themes and include a screenshot.
6. Update the relevant document in `docs/` when behaviour changes.

## Licence

By contributing you agree that your contributions are licensed under the [GNU Affero General Public License v3.0](LICENSE). The Frontier name and official art are not covered by the code licence.
