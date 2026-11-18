# Province development

Population is now a local strategic resource. Each province owns its development points and learned skills; national trade credits fund advanced choices. Research never consumes citizens.

## Rules

- Each production cycle (3 game seconds), an owned province connected to a living capital earns `1 + floor(population / 150) + research bonuses` development points.
- The 24 skills are split into Economy, Civil development, Policies and Defence. Each has four tiers: a foundation, two parallel paths, a shared advanced node, and two mutually exclusive specializations.
- Costs by tier: 4/8/12/18 local points, 0/2/4/6 national credits. Population requirements: 40/60/100/140 citizens.
- A province can learn 12 skills in total. Each skill is learned once. Choices cannot be refunded; each province can choose differently.
- Conquest transfers the province with its skills and unspent development. Population loss on capture does not unlearn skills. A rematch starts fresh.
- Effects apply only to that province. Local income goes to its current owner's treasury. International trade bonuses belong to the owner of the upgraded endpoint.
- Self-government keeps local production running without a connection to the capital, but never after the owner's capital has fallen.
- Land attacks use the departure province's attack bonus. Naval expeditions snapshot that bonus when launched. Defence is evaluated at the destination. Skill power does not create extra surviving soldiers.

## Branch identities

| Branch | Foundation and paths | Exclusive specialization |
| --- | --- | --- |
| Economy | Market, artisan guilds, trade offices, municipal bank | Free port (trade revenue) or industrial hub (recruitment) |
| Civil | Clean water, food reserves, public schools, hospital | Metropolis (population) or university city (development) |
| Policies | Council, civic registry, public works, provincial charter | Self-government (isolated production) or cooperative (growth and revenue) |
| Defence | Citizen watch, training grounds, civil shelters, academy | Bastion (defence and repairs) or expedition corps (attack and recruitment) |

## Interface

Right-click your province → Manage population. The panel shows population, local development, national credits, remaining choices, branch progress, prerequisites, exclusive choices and active bonuses. It stays alongside the map, including in fullscreen. Light and dark themes use the same theme tokens and Lucide icons.

Bots research through the same validated command and pay the same costs. They prioritize useful attacks and troop transfers; easy bots consider research every 12 seconds, normal/expert every 6 seconds. Expert priorities favor defence, normal priorities favor economy.

## Extension and balance

`src/engine/population.ts` is the shared catalog, cost model, availability validation and effect aggregation. `PopulationPanel.tsx` reads it rather than duplicating eligibility rules. `game.ts` applies production, trade, construction and combat effects. Legacy three-level upgrades remain accepted by the engine for compatibility; the player interface uses the new skill tree.

This is an initial balance, not a completed balance pass. Track branch adoption, time to specialization, economic snowballing, and bot match duration. Future work can add local professions, policy trade-offs, culture-specific branches and research queues without introducing account-level power.

Validation covers all skill prerequisite paths, spending and immutability, illegal commands, branch exclusivity, choice budget, production, construction discounts, international trade, isolation, conquest, replay and land/naval combat.
