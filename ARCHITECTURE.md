# Architecture

## Overview

Cannon Riot separates application UI, persistent/remote data concerns and real-time combat.

- **React** owns navigation, menu/forms, options, result UI, semantic HUD, audio/language controls, jukebox and ranking/history panels.
- **PixiJS** owns the real-time arena: ships, islands, projectiles, health bars, procedural water decoration and combat effects.
- **GameEngine** is the authoritative match orchestrator. Continuous combat state stays outside React.
- **InputManager** owns keyboard/touch action state.
- **TanStack Query + Axios** own ranking/history requests and match registration.
- **MSW** implements the REST simulation in development, preview, E2E and the published build.
- **localStorage** persists gameplay settings, language/audio preferences, player identity, mock-confirmed records, the last completed result, network demo scenario and pending-match outbox.

The authoritative gameplay world is always 1280×720; the DOM/canvas scales around it.

## React/PixiJS lifecycle

`GameScreen` creates one `GameEngine` per match. On unmount the engine destroys its Pixi application and clears listeners/resources. This design is compatible with React Strict Mode mount → destroy → mount behavior.

React receives a throttled gameplay snapshot roughly every 80 ms for HUD data. The Pixi ticker remains authoritative for movement, AI, cooldowns, projectiles, buffs and effects.

Cleanup includes:

- main ticker callback;
- active comic-panel/effect ticker callbacks via container teardown;
- keyboard input listeners;
- blur/visibility listeners;
- `ResizeObserver`;
- Pixi display tree/application;
- runtime audio references.

Leaving combat before a completion event simply destroys the engine; no match registration occurs.

## Boot and asset preload

`preloadAllAssets()` runs before normal menu use. It starts the MSW worker and preloads:

1. gameplay/reaction textures through Pixi `Assets`;
2. menu/result wallpapers through DOM `Image`;
3. SFX through `fetch` + object URLs;
4. soundtrack tracks through the same audio path.

Pixi texture loading uses concurrency 3 and up to three attempts per texture. Permanent failures log `[Cannon Riot preload]` diagnostics, including the resolved URL and an HTTP `HEAD` check, then propagate to the visible boot error/retry state. After the preload reaches 100%, the boot screen stays mounted until the player presses **Board the Ship**. That deliberate browser gesture unlocks HTML audio before React reveals the menu, allowing the menu track to start immediately instead of waiting for an unrelated later click.

The loader keeps original asset URLs; it does not append cache-busting query strings.

## Match configuration snapshot

Options persist a sanitized `GameConfig`. `GameScreen` takes a `structuredClone` before constructing the engine, so a running match cannot observe later settings changes.

The leaderboard comparison key deliberately uses only:

```ts
{
  sessionTime,
  enemySpawnTime,
}
```

All remaining values are versioned code/balance constants, not player-controlled leaderboard dimensions.

## Time model

Ticker `deltaMS` is converted to seconds and clamped to at most 0.05 s for each simulation update. Movement, AI, cooldowns, projectile lifetime, buffs, support timers, spawn cadence and match duration all use simulation time.

Paused ticks do not advance `elapsed`, so stored match duration excludes paused time.

For E2E, `?e2e=1` fixes the seed to `1337` and exposes a fixed-step `advanceTime(seconds)` hook that calls the same simulation update path.

## Input model

Keyboard and touch map to the same `GameAction` set. Desktop uses held keys; touch controls keep an independent pointer-to-actions registry, where one pointer may own multiple actions. The diagonal D-pad zones therefore activate **forward + left** or **forward + right** from a single thumb, while separate pointers can still combine steering with attacks. Pointer capture is used when available, with per-pointer cleanup on release/cancel/lost capture.

Normal artillery uses independent front/broadside reloads plus a short global switch lock:

- front cooldown: 0.38 s by default;
- shared broadside cooldown: 1.10 s by default;
- front ↔ broadside switch lock: 0.25 s;
- quick touch action buffer: 0.32 s.

Living Powder deliberately bypasses the normal switch rule and auto-fires front + both broadsides until the buff expires.

## Dash state and damage semantics

Dash is a timed state, not an instant teleport. Its default active duration is 0.28 s. Movement is advanced in small steps so arena/island collision remains authoritative.

`damageShip()` ignores damage to the player only while `isDashing()` is true. There is no grace period after `finishDash()`.

If a dash intersects a live Chaser, the Chaser is destroyed, the player takes no collision damage and the dash may continue. Because the dash is now an explicit player attack, that destruction awards one point and routes through the normal victory portrait pool with a dedicated `victoryDash` line group. A non-dash Chaser collision is still a non-scoring self-destruction.

While **Wind at Your Back** is active, `dashCooldown` is kept at zero. Dash distance remains wind-boosted, and every completed dash is immediately available again until the buff timer expires.

## Collision model

Ship and projectile interactions are separated into explicit checks:

- ship × arena bounds;
- ship × island colliders;
- ship × ship;
- projectile × island;
- projectile × arena exit;
- player projectile × live enemy;
- enemy projectile × live player or live Kraken.
- Kraken × ship hull; Chaser contact becomes a self-destructing ram against the Kraken.
- Kraken tentacle area × player/normal enemies.

Island art is procedural/irregular, while collision is represented by stable circle colliders. Projectiles use substeps so boosted shots cannot tunnel through small colliders. A projectile is removed immediately after its first valid hit.

Dead enemies are ignored by movement, AI, collision and projectile loops.

## Enemy spawning and AI

Enemy type order follows the deterministic `['chaser', 'shooter']` pattern so both required types appear in a normal match.

Spawn candidates are validated against arena bounds, islands, active enemies and a minimum distance from the player. If no safe point exists, spawning is retried later rather than forcing an invalid spawn.

A newly spawned enemy receives a short `!` visual telegraph attached to the ship. This is presentation only: AI, collision and attack timing are active immediately.

Chasers use pursuit/steering, island avoidance and stuck recovery. Shooters combine approach/orbit steering, line-of-sight checks, range management and an aim/fire cycle.

A deterministic pressure value derived from `sessionTime` and `enemySpawnTime` adjusts the active-enemy cap and support/balance coefficients for extreme configurations.

### Kraken third-faction AI

The Kraken is represented by a separate `KrakenEntity`, not by extending the required `EnemyKind` union. This keeps the challenge-mandated Chaser/Shooter spawn pattern intact while allowing a neutral-hostile boss/third faction. `maybeSpawnKraken()` makes the first creature eligible at 30% of session duration and schedules another 7–10 s after defeat when at least 6 s remain; no random despawn path exists and the active count is hard-limited to one.

`updateKraken(dt)` treats roaming as the creature's primary intent. The entity keeps a distant safe-water destination and strongly prefers a different map quadrant; reaching that point or detecting a persistent stuck state selects another. A visible player/enemy inside 285 px can trigger only a short seeded 2.3–3.2 s pursuit, followed by a mandatory 4.6–6.2 s roaming commitment before another chase is allowed. The saved roam destination survives the chase, so dense 1 s spawn traffic cannot continuously replace the navigation goal. Attacks are independent of locomotion: `KrakenEntity.attackSlots` owns five arm timers, each ready arm chooses a visible target inside 210 px, snapshots that impact point, telegraphs for roughly 0.40 s, resolves independently, then receives a seeded 0.82–1.28 s personal cooldown while the body continues swimming. Per-target repeat cooldowns (0.55–0.85 s) prevent dog-piling one victim at the exact same moment. Navigation still uses the lightweight coarse A* water grid, full-collider checks, path smoothing and stuck-triggered replanning. Normal enemy targeting goes through `enemyTarget(enemy)`: proximity only makes the Kraken eligible when it is the more attractive nearby target, with an 80 px hysteresis margin; if a tentacle damages an enemy, that enemy retaliates for 5 s. Enemy cannonballs are reduced to 55% damage against the boss and Chaser rams deal 24 damage; those kills never credit the player.

The Kraken counts as three slots for normal spawn-cap calculations, while the HUD counts its visible body as one enemy entity. Its static base artwork is augmented at runtime with four lightweight procedural tentacles plus animated water rings and subtle squash/stretch, avoiding the old vertical bob that made it look like it was hovering. Player projectiles and powder-barrel damage can finish it; only a player-caused final hit awards +1. Player/Kraken hull contact reuses the friction comic portraits with Kraken-specific lines and applies time-based grinding damage to both sides (4.5 HP/s player, 18 HP/s Kraken); a friction finishing hit is owned by the player. Kraken hit feedback avoids ship-fire deterioration, and `destroyKraken()` now reuses the normal explosion VFX instead of a bespoke sinking/deformation sequence.

## Pickups and support director

Four pickup kinds exist: Medicine, Living Powder, Wind at Your Back and Reinforced Hull. Regular support drops use pressure, hull state and active buffs to choose useful pickups.

At ≤35% hull, `maybeSpawnEmergencyDrop()` checks for nearby Medicine/Armor support. If none exists and the 12 s emergency cooldown is ready, it attempts to place a defensive crate 105–180 px from the player. When the normal pickup cap is already full, it may replace a less useful/farther crate so emergency support is not silently blocked.

Repeated buffs extend duration with a capped extension rather than fully resetting without limit.

## Powder barrel

The player can keep up to three active barrels. A barrel arms after 0.48 s, lasts 10.5 s and triggers when an enemy enters its trigger radius.

The triggering enemy is a guaranteed scoring kill. Other enemies inside the 170 px blast radius receive falloff splash damage clamped so the blast cannot finish them; they remain at a minimum of 1 HP. The player's own barrel blast never damages the player.

This keeps the trap useful against dense groups without turning one barrel into an automatic multi-kill chain.

## Reaction panels and audio ownership

Damage, victory, idle and mechanic panels are Pixi overlays. Placement avoids the player safety zone and tries to avoid active panel overlap.

Idle panels are the only reaction path that plays `idle_captain_chirp.wav`. Dash/pickup/barrel mechanic panels do not reuse the idle chirp. Player destruction owns its explosion sound so a lethal projectile produces both hit feedback and the destruction explosion; Chaser collision avoids doubling the same explosion event.

## Pause semantics

Manual pause and automatic blur/hidden-tab pause use the same path. Pausing disables/clears input and sets ticker speed to zero. Focus restoration never auto-resumes; explicit player input is required.

## Player identity and persistence

The app creates a local UUID and an editable display name capped at 24 characters. Completed matches capture both. History requests are keyed by UUID, while ranking shows the captured display name.

Gameplay options are sanitized when loaded/saved. The last completed result is persisted separately from the flag that decides whether the result screen should resume after refresh.

## Match registration and outbox

A stable `matchId` is created before any network request. `useRegisterMatch()` enqueues the result before POSTing; success removes only that id.

The outbox is `MatchResult[]`, allowing multiple pending records. It survives refresh and is retried on application bootstrap and menu return.

MSW persists confirmed records in a separate local mock database and treats `matchId` as idempotent. This makes “server stored the match but the response timed out” recover without duplication.

## Ranking/history query consistency

Ranking query keys include session time, spawn interval, page and current network scenario. History keys include player id, page and scenario.

GET query functions receive TanStack Query's `AbortSignal` and pass it to Axios. Successful match registration invalidates ranking and history. `keepPreviousData` keeps pagination transitions stable while new pages load.

## Responsive rendering and touch performance

World coordinates and gameplay rules never change with viewport size. The canvas is uniformly CSS-scaled to available space.

Desktop:

- antialiasing enabled;
- renderer resolution capped at device DPR 2;
- full decorative water/effect density.

Touch/coarse-pointer profile:

- renderer resolution forced to 1;
- Pixi antialiasing disabled;
- ticker capped at 50 FPS;
- expensive `BlurFilter`s skipped;
- reduced caustics, reefs, wavelets and ripples;
- visual particle cap reduced from 120 to 48;
- reduced projectile trail probability/budget, wake frequency and explosion debris.

These changes are presentation/performance only. AI, damage, collision, timers, spawn rules and score are identical.

## Internationalization

English is the first-run/default language. Portuguese and Spanish are live alternatives. React UI updates immediately; the engine stays mounted. Newly created Pixi labels/reaction copy reads the current global language when emitted.
