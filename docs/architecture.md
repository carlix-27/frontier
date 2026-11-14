# Frontier architecture direction

## Principle

The game engine is deterministic and independent from rendering, networking, and persistence. Browser UI, bots, future server matches, replays, and the campaign service depend on the same rules rather than copying them.

```text
Local browser match + bots
        -> authoritative online 1v1 matches
        -> verified result service
        -> weekly campaign map, profiles, parties, and cosmetics
```

## Current boundaries

```text
src/engine/    Pure state, map data, commands, rules, events, and simulation ticks
src/bots/      Decision-making through public engine commands only
src/main.ts    Browser UI, Canvas rendering, and local match orchestration
```

## Engine rules

The engine accepts a state and validated command, then returns the next state. It does not access the DOM, network, wall clock, or uncontrolled randomness. A future replay can therefore be represented by a map seed and command log.

## Online path

When multiplayer begins, the server becomes authoritative. Clients submit commands; they never submit a trusted score. A match service runs the same engine and emits a verified result record to the campaign service.

```text
Browser command -> match service validates it -> deterministic engine
                                                 -> result record
                                                 -> campaign aggregator
                                                 -> world-map update
```

Match instances scale independently. The campaign service processes compact match results instead of every real-time game command.

## Deferred decisions

- Network protocol and hosting provider.
- Database and authentication.
- Rendering upgrade beyond Canvas 2D.
- Exact balance values and multiple maps.

Those choices follow a local vertical slice and external playtest feedback.
