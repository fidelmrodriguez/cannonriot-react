# Architecture

## Overview

Cannon Riot separates application UI, persistent/remote data concerns and real-time combat responsibilities.

- **React** owns navigation, menu/forms, result state, semantic HUD, audio/language controls, options and remote-data panels.
- **PixiJS** owns the visible combat arena, ships, projectiles, obstacles, health bars and real-time effects.
- **GameEngine** is the match orchestrator. Continuous combat state stays there and never lives in React state frame-by-frame.
- **InputManager** owns keyboard/touch action state.
- **TanStack Query + Axios** own remote ranking/history requests.
- **MSW** provides the REST simulation in development, preview, tests and deployed builds.
- **localStorage** persists settings, language/audio preferences, local player identity, mock-confirmed records, the last completed result and the pending-match outbox.

## React/PixiJS lifecycle

`GameScreen` creates one `GameEngine` for one match. The engine is destroyed on unmount. React Strict Mode therefore exercises mount → destroy → mount without intentionally keeping duplicate Pixi applications or listeners alive.

The engine reports a throttled snapshot to React roughly every 80 ms. The Pixi ticker remains the source of truth for continuous movement, projectile state, AI, cooldowns and combat effects.

Cleanup includes:

- removing the main ticker callback;
- removing active comic-panel ticker callbacks;
- detaching keyboard listeners;
- removing blur/visibility listeners;
- disconnecting the ResizeObserver;
- destroying the Pixi application/container tree;
- clearing audio references.

## Match configuration snapshot

Options persist a sanitized typed configuration. `GameScreen` takes a `structuredClone` before constructing `GameEngine`. A running match therefore cannot observe later settings changes.

The editable leaderboard key is intentionally:

```ts
{
  sessionTime,
  enemySpawnTime,
}
```

All other gameplay constants are versioned code/balance parameters rather than user-controlled leaderboard dimensions.

## Time model

Pixi ticker `deltaMS` is converted to seconds and clamped before simulation updates. Movement, rotation, AI, cooldowns, projectile lifetime, buff lifetime, spawn cadence and match duration all use elapsed simulation time.

The match duration recorded at the end comes from the simulation clock. Paused time is not included because paused ticks do not advance `elapsed`.

For E2E, `?e2e=1` fixes the seed and exposes a test-only `advanceTime(seconds)` hook that advances the same simulation update path at fixed steps.

## Pause semantics

Manual pause and automatic blur/hidden-tab pause call the same pause path. Pausing disables and clears input and sets ticker speed to zero. Returning focus does not auto-resume. The player must explicitly resume, preventing accumulated held input from firing after focus returns.

## Collision model

The authoritative arena is 1280×720. Ship movement is clamped to the visible arena. Island visuals are irregular procedural layers, while collision uses multiple circles per island.

Interactions are separate:

- ship × arena bounds;
- ship × island;
- ship × ship;
- projectile × island;
- projectile × arena bounds;
- player projectile × live enemy;
- enemy projectile × live player.

Projectiles use substeps so high-speed boosted shots cannot tunnel through small colliders. A projectile is marked inactive/removed immediately after its first valid hit.

Dead enemies are skipped by movement, AI, collision and projectile loops. Chaser collision calls the destruction path with `awardPoint = false`; projectile/player-attack kills call it with `true`.

## Enemy spawning and AI

Enemy types are distributed deterministically by sequence so both Chaser and Shooter appear in a normal match. Spawn candidates are generated around arena edges and validated against:

- player minimum distance;
- island collision;
- active-enemy spacing;
- arena bounds.

If no valid position exists, spawning is retried later instead of falling back to an invalid point.

AI uses steering, island look-ahead, line-of-sight checks for Shooters, separation and stuck recovery. A dynamic active-enemy cap protects both fairness and performance under the 1-second spawn configuration.

## Local player identity

Authentication is out of scope in the challenge, but player identification is required. The app creates one persistent UUID and an editable local display name. Both are captured in every completed match record and history queries are keyed by the UUID.

## Match registration and outbox

Completed matches are represented by a stable `matchId` UUID before any network call. The client writes the match into a persistent outbox before POSTing.

The outbox is `MatchResult[]`, not a single pending slot. This allows:

```text
Match A -> pending
Match B -> confirmed
Match C -> pending
```

without blocking a new match.

On success, only the matching `matchId` is removed. On failure/timeout it stays. The app retries pending records on bootstrap and again when returning to the menu.

MSW stores confirmed records by `matchId` and returns an existing record for duplicate retries. This provides idempotency for “saved on server, response timed out, client retries”.

## Ranking/history query consistency

Ranking query keys contain session time, spawn interval and page. History keys contain `playerId` and page. TanStack Query provides cache ownership and invalidation.

Query functions receive TanStack Query's `AbortSignal` and pass it to Axios. Obsolete requests can therefore be cancelled rather than manually racing component state. The MSW out-of-order scenario deliberately returns alternating delays to exercise this behavior.

## Result persistence vs abandoned matches

A completed result is persisted locally and marked as resumable so a refresh on the result screen restores it. Choosing Main Menu or Play Again clears only the “resume result screen” marker, not the last result record itself.

Leaving/reloading while combat is active simply destroys the match engine. Because no completion callback runs, abandoned matches never enter the outbox, ranking or history.

## Responsive rendering

World coordinates never change with viewport size. The Pixi canvas is scaled uniformly to fit available space. DPR is capped at 2. Mobile/tablet uses the same simulation and world dimensions with a touch overlay and a landscape-first shell.

## Internationalization

English is the first-run default. Language state is global and the Pixi engine reads the current language when it creates new labels/reacts. Switching language during combat changes React UI immediately without remounting GameEngine; newly emitted Pixi text uses the new language.
