# Frontier backlog

This document mirrors the initial GitHub issue plan. Issues are deliberately ordered to achieve a playable local MVP before online services, campaigns, or monetization.

## Milestone: Local playable MVP

| Priority | Title | Labels | Outcome |
| --- | --- | --- | --- |
| P0 | `chore: bootstrap the TypeScript browser prototype` | `type:chore`, `area:client`, `mvp` | Vite, TypeScript, build, test and local dev commands work. |
| P0 | `feat(engine): implement deterministic territory simulation` | `type:feature`, `area:engine`, `mvp` | Commands, production, capture, supply and victory rules are pure and tested. |
| P0 | `feat(client): render and control a local territorial match` | `type:feature`, `area:client`, `mvp` | A player can select territories and issue every command on a readable map. |
| P0 | `feat(bot): add configurable local opponent profiles` | `type:feature`, `area:bot`, `mvp` | Easy, normal and expert bots follow rules without hidden bonuses. |
| P0 | `test: add command validation and deterministic replay coverage` | `type:test`, `area:engine`, `mvp` | Invalid moves, seeded simulations and core outcomes are covered. |
| P1 | `feat(gameplay): add match onboarding and post-match summary` | `type:feature`, `area:client`, `mvp` | A new player understands commands, victory, defeat and restart. |
| P1 | `balance: define initial economy and bot benchmark scenarios` | `type:balance`, `area:engine`, `mvp` | Match length and bot win rates are measured across repeatable scenarios. |
| P1 | `docs: publish local setup, rules and contribution guide` | `type:docs`, `good first issue`, `mvp` | New contributors can run and understand the project. |

## Milestone: Multiplayer foundation

| Priority | Title | Labels | Outcome |
| --- | --- | --- | --- |
| P2 | `feat(server): run authoritative 1v1 matches` | `type:feature`, `area:server`, `multiplayer` | A server validates commands with the shared engine. |
| P2 | `feat(replays): persist match command logs and results` | `type:feature`, `area:engine`, `multiplayer` | Results are auditable and replayable. |
| P2 | `feat(matchmaking): create a minimal casual queue with bot fallback` | `type:feature`, `area:server`, `multiplayer` | Players find a match without long waits. |

## Milestone: Campaign and sustainable business

| Priority | Title | Labels | Outcome |
| --- | --- | --- | --- |
| P3 | `feat(campaign): model factions, fronts and weekly resets` | `type:feature`, `area:campaign` | A verified result can alter a weekly map. |
| P3 | `feat(profile): add account identity and cosmetic inventory` | `type:feature`, `area:profile` | Cosmetics attach to an account, not competitive power. |
| P3 | `feat(monetization): add cosmetic-only supporter packs` | `type:feature`, `area:commerce` | Optional purchases never alter match balance. |

## Progress notes

- `balance: define initial economy and bot benchmark scenarios` — initial version: `src/bots/benchmark.ts` and `npm run benchmark` play five repeatable bot-versus-bot scenarios. Win-rate targets are still to be agreed.
- `docs: publish local setup, rules and contribution guide` — `CONTRIBUTING.md`, plus rules in `docs/map-generation.md` and `docs/population-development.md`.
- Map generation v2: custom worlds in the setup screen, terrain, names, scattered layouts, fairer capitals and sea lanes through open water.
- Province development: research plans, a visual tree with requirement chips and time estimates, role-based bot research.

## Economy decision

The local MVP has **no currency, premium currency, ads, store, or payment flow**. These mechanics would obscure whether the match itself is fun.

After the MVP, use a two-currency model only if cosmetics are ready:

- **Renown:** earned from completed matches, weekly participation and achievements. It buys standard cosmetics.
- **Frontier Tokens:** optional paid currency, used only for premium cosmetics, a seasonal visual pass, and supporter bundles.

Competitive resources such as units, influence, territory control, bot difficulty, queue priority, and campaign contribution must never be purchasable. No diamonds are necessary at first; `Frontier Tokens` is clearer and avoids a generic mobile-game feel.
