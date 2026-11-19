# Province development

Population is now a local strategic resource. Each province owns its development points and learned skills; national trade credits fund advanced choices. Research never consumes citizens.

## Rules

- Each production cycle (3 game seconds), an owned province connected to a living capital earns `1 + floor(population / 150) + research bonuses` development points. Hills add +1.
- The 24 skills are split into Economy, Civil development, Policies and Defence. Each has four tiers: a foundation, two parallel paths, a shared advanced node, and two mutually exclusive specializations.
- Costs by tier: 4/8/12/18 local points, 0/2/4/6 national credits. Population requirements: 40/60/100/140 citizens.
- A province can learn 12 skills in total. Each skill is learned once. Choices cannot be refunded; each province can choose differently.
- Conquest transfers the province with its skills and unspent development. Population loss on capture does not unlearn skills. A rematch starts fresh.
- Effects apply only to that province. Local income goes to its current owner's treasury. International trade bonuses belong to the owner of the upgraded endpoint.
- Self-government keeps local production running without a connection to the capital, but never after the owner's capital has fallen.
- Land attacks use the departure province's attack bonus. Naval expeditions snapshot that bonus when launched. Defence is evaluated at the destination. Skill power does not create extra surviving soldiers.

## Research plans

Any skill can be set as a province's **plan**. The engine works out the missing prerequisites (`researchPath`) and learns the next step automatically during production as soon as the province has the points, citizens and credits for it — one step per cycle. The plan is validated up front (exclusive choices and the 12-choice budget), can be cancelled at any time, completes when the goal is learned (also by hand), and is dropped if the province is captured. Plans use the same `planResearch` command for players and bots.

`researchEstimate` reports what is still missing for the whole path — development points, credits, citizens — and how long the points take at the current rate. `skillRequirements` lists every requirement with its status for the interface.

## Branch identities

| Branch | Foundation and paths | Exclusive specialization |
| --- | --- | --- |
| Economy | Market, artisan guilds, trade offices, municipal bank | Free port (trade revenue) or industrial hub (recruitment) |
| Civil | Clean water, food reserves, public schools, hospital | Metropolis (population) or university city (development) |
| Policies | Council, civic registry, public works, provincial charter | Self-government (isolated production) or cooperative (growth and revenue) |
| Defence | Citizen watch, training grounds, civil shelters, academy | Bastion (defence and repairs) or expedition corps (attack and recruitment) |

## Interface

Right-click your province → Manage population. The panel shows:

- the province's role (capital, frontier or interior) and terrain;
- citizens, local development with its rate per cycle, and national credits;
- the active plan with its next step and estimated time;
- one tab per branch with a progress bar and how many skills are ready;
- the branch as a real tree: connectors turn green when learned and dashed blue along a planned path; exclusive specializations are marked **OR**, and the one not chosen is struck through;
- a detail card for the selected skill: effects, every requirement as a met/missing chip, the path length and time from here, **Learn now** and **Plan path**.

It stays alongside the map, including in fullscreen. Light and dark themes use the same theme tokens and Lucide icons.

## Bots

Bots research through the same validated commands and pay the same costs. Research costs no troops, so on research turns (every 6 seconds; 12 for easy bots) they research before routine attacks — unless an enemy capital can be taken right now. They specialise each province by role: capitals favour civil development, frontier provinces defence, interior provinces economy. Normal and expert bots also set long-term plans (expert: University city, Bastion, Industrial hub; normal: Metropolis, Expedition corps, Free port) when nothing is affordable.

## Extension and balance

`src/engine/population.ts` is the shared catalog, cost model, availability validation and effect aggregation. `PopulationPanel.tsx` reads it rather than duplicating eligibility rules. `game.ts` applies production, trade, construction and combat effects. Legacy three-level upgrades remain accepted by the engine for compatibility; the player interface uses the new skill tree.

This is an initial balance, not a completed balance pass. `npm run benchmark` plays the scenarios in `src/bots/benchmark.ts` bot-versus-bot and prints winner, length, how the match ended, territories claimed and skills learned. Track branch adoption, time to specialization, economic snowballing, and bot match duration. Future work can add local professions, policy trade-offs, culture-specific branches and research queues without introducing account-level power.

Validation covers research plans (ordering, exclusivity, budget, automatic learning, cancellation, capture), estimates, requirement status, terrain development, role-based bot research, all skill prerequisite paths, spending and immutability, illegal commands, branch exclusivity, choice budget, production, construction discounts, international trade, isolation, conquest, replay and land/naval combat.
