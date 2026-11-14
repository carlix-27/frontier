# Frontier MVP

## Product promise

Frontier is a PC browser strategy game in which a player can make a useful territorial decision immediately, finish a match in a few minutes, and understand why they won or lost.

The MVP proves the match loop before it proves online scale. A player should want a second match because tactical choices are satisfying, not because the game applies artificial pressure.

## Match definition

The first playable build is **one human player versus one bot**.

| Item | MVP decision |
| --- | --- |
| Platform | Desktop browser only |
| Match length | 4-8 minutes |
| Map | One connected territory graph |
| Players | One human and one bot |
| Objective | Capture the enemy capital, or lead on control score when time expires |
| Resources | Units / influence |
| Inputs | Expand, fortify, supply |
| Information | Full map visibility; no fog of war |

## Core loop

1. Start a local match.
2. Expand into neutral territory and protect supply lines.
3. Decide whether to attack, fortify, or improve a route.
4. Defeat a bot or win on score before time ends.
5. Review the result and play again with a new tactical approach.

## Bots

Bots use the exact same commands and public game state as the human player. The first versions are deterministic given equal game state.

- **Easy:** acts less often and attacks only with a large advantage.
- **Normal:** balances expansion, border defence, and supply.
- **Expert:** acts more often and accepts narrower tactical advantages.

Difficulty changes decision timing and judgement thresholds, never gives a bot invisible bonus units.

## Weekly campaign: after the MVP

A seven-day campaign with three factions is a retention layer for the online game, not a dependency of the first prototype. Verified online match results will contribute war points to campaign fronts, which update a shared map in batches. The local prototype shows only the match result.

## Explicit non-goals

- Mobile support.
- Massive persistent real-time battles.
- Tech trees, unit classes, crafting, or diplomacy.
- Chat, clans, accounts, payments, or a public online service.
- Pay-to-win, energy systems, loot boxes, or punitive login streaks.
