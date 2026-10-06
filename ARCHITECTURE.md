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
- player projectile × live enemy/Kraken;
- enemy projectile × live player or Kraken according to the projectile target;
- Chaser hull × Kraken hull (rammer explodes and damages Kraken);
- Kraken tentacle AoE × player/enemy ships.

Island art is procedural/irregular, while collision is represented by stable circle colliders. Projectiles use substeps so boosted shots cannot tunnel through small colliders. A projectile is removed immediately after its first valid hit.

Dead enemies are ignored by movement, AI, collision and projectile loops.

## Enemy spawning and AI

Enemy type order follows the deterministic `['chaser', 'shooter']` pattern so both required types appear in a normal match.

Spawn candidates are validated against arena bounds, islands, active enemies and a minimum distance from the player. If no safe point exists, spawning is retried later rather than forcing an invalid spawn.

A newly spawned enemy receives a short `!` visual telegraph attached to the ship. This is presentation only: AI, collision and attack timing are active immediately.

Chasers use pursuit/steering, island avoidance and stuck recovery. Shooters combine approach/orbit steering, line-of-sight checks, range management and an aim/fire cycle.

A deterministic pressure value derived from `sessionTime` and `enemySpawnTime` adjusts the active-enemy cap and support/balance coefficients for extreme configurations.

### Kraken third faction

The Kraken is stored separately from the required `EnemyEntity[]` ship sequence as a `KrakenEntity`. This preserves the deterministic Chaser/Shooter spawn pattern while allowing one optional neutral-hostile arena event. `maybeSpawnKraken()` becomes eligible at 30% of session time, requires at least 15 s remaining and checks that two enemy-cap slots are available. A live Kraken contributes a slot weight of two when normal ship spawns are evaluated. Once the event is eligible, normal spawns reserve those two slots so a high-density 1 s configuration cannot permanently starve the Kraken event.

`updateKraken()` recomputes the nearest living target every simulation tick across the player and all live enemy ships. Movement follows that nearest target; a tentacle strike locks its impact point for a 0.55 s telegraph, then resolves one AoE damage pass. There is no random despawn path: the entity remains until defeated or the match is torn down.

Enemy ships use `getEnemyCombatTarget()`. Shooters within 420 px and Chasers within 330 px can switch to the Kraken when it is closer than the player; an 80 px release margin provides hysteresis and lets a clearly closer player reclaim aggro. Shooter projectiles carry an explicit `target` (`player` or `kraken`) so faction damage is deterministic. Chaser/Kraken hull contact is resolved in the normal solid-hull collision path: the Chaser explodes, damages the Kraken and does not award score.

## Pickups and support director

Four pickup kinds exist: Medicine, Living Powder, Wind at Your Back and Reinforced Hull. Regular support drops use pressure, hull state and active buffs to choose useful pickups.

At ≤35% hull, `maybeSpawnEmergencyDrop()` checks for nearby Medicine/Armor support. If none exists and the 12 s emergency cooldown is ready, it attempts to place a defensive crate 105–180 px from the player. When the normal pickup cap is already full, it may replace a less useful/farther crate so emergency support is not silently blocked.

Repeated buffs extend duration with a capped extension rather than fully resetting without limit.

## Powder barrel

The player can keep up to three active barrels. A barrel arms after 0.48 s, lasts 10.5 s and triggers when a normal enemy ship or the Kraken enters its trigger radius.

A triggering Chaser/Shooter is a guaranteed scoring kill. A triggering Kraken instead takes the stored 62 damage. Other normal ships inside the 170 px blast radius receive falloff splash damage clamped so the blast cannot finish them; a Kraken in the blast receives falloff damage normally. The player's own barrel blast never damages the player.

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
