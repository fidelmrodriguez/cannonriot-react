# Challenge compliance audit

This document maps the implementation to the public `junglegaming/game-developer-challenge` requirements.

## Stack

| Requirement | Implementation |
| --- | --- |
| React UI | Menus, options, ranking/history, result, pause dialog, semantic HUD |
| TypeScript strict | `tsconfig.app.json` has `strict: true` |
| PixiJS gameplay | Arena, ships, projectiles, islands, effects, health bars |
| TanStack Query | Ranking/history queries and match registration mutation |
| Axios | All ranking/history/register HTTP calls |
| MSW | Browser worker starts before the app finishes global preload; runs in deployed build |
| Playwright | Chromium desktop + landscape touch projects |

## Gameplay

- Forward movement + left/right rotation: implemented in `InputManager` + `GameEngine`.
- Front shot: one projectile.
- Broadsides: three parallel projectiles per side.
- Simultaneous movement/firing: independent action state supports held combinations.
- Player finite health: projectile and Chaser collision damage.
- Visible arena bounds + island collision: enforced by movement and projectile systems.
- Chaser: pursuit, rotation, island avoidance, collision damage + self-destruction.
- Shooter: approach/orbit, line of sight, range check, rotation, ranged projectile.
- Both enemy types in normal match: deterministic alternating spawn sequence.
- Safe spawn: obstacle, player-distance and enemy-spacing validation; no invalid fallback.
- Projectile direction/speed/damage/lifetime: centralized config + entity state.
- Single-hit projectile: projectile is removed immediately after hit.
- Dead enemy exclusion: all loops check `alive`.
- Configurable duration: 60–180 seconds.
- Chaser self-destruction gives no point; player attack kill gives exactly one.
- Match freezes after end; restart mounts a clean engine.
- Health bars above player/enemies plus React score/time HUD.
- Manual and automatic pause; no auto-resume; input cleared on pause.
- Firing, explosion, hit, damage/deterioration feedback: implemented.

## Screens/configuration

- Main menu: Play, Options, controls, Ranking, Match History.
- Options: session time + spawn interval, validation and local persistence.
- Result: score, effective duration, end reason, registration state, Play Again/Main Menu.
- Ranking: player identification, score, deterministic order and pagination.
- History: local-player history with date, score, duration, end reason, pagination.
- Gameplay config is typed and centralized.
- Match receives a configuration snapshot at start.
- Page reload/leave during combat abandons without registration.
- Last completed result is persisted locally.
- English is the first-run/default UI; Portuguese/Spanish are optional extras.

## Architecture/lifecycle

- Continuous combat state stays in GameEngine; React receives throttled snapshots.
- Time-based simulation uses delta seconds and clamps large deltas.
- Texture/audio preload happens before normal navigation; game-level loading also exposes progress/error/retry.
- Responsive canvas preserves world coordinates and aspect ratio.
- Input/listeners/ticker/ResizeObserver/Pixi resources are cleaned on unmount.
- App runs under React Strict Mode.

## Ranking/history integrity

- `matchId` UUID is created once and reused on retry.
- Player UUID + display name are persistent and captured before play.
- Effective duration comes from simulation time.
- Ranking compares exactly `sessionTime + enemySpawnTime`. Every confirmed `matchId` remains an individual ranking entry.
- Tie-break is deterministic: score desc, duration asc, date asc, match id.
- TanStack Query keys include config/page for ranking and player/page for history.
- Query `AbortSignal` is passed to Axios.
- Successful registration invalidates both ranking and history.
- A persistent array outbox preserves multiple pending matches.
- Retry after timeout is idempotent in MSW.
- Pending records are retried after refresh and on menu return.
- A pending record does not block Play Again/new matches.

## MSW scenario coverage

Implemented scenarios:

- success;
- empty lists;
- multiple pages;
- slow response;
- generic request timeout;
- deterministic variable latency;
- out-of-order responses;
- connection failure;
- HTTP 422;
- HTTP 503;
- ranking-only failure;
- history-only failure;
- timeout after save;
- backend unavailable at game over and recovery.

The Options screen can select scenarios and reset mock state. Confirmed mock records and client outbox persist through refresh. Resetting the mock database intentionally does not erase the client outbox.

## Accessibility/responsive behavior

- Keyboard navigation uses native controls.
- Visible focus styles are global.
- Form inputs/selects have labels.
- Pause uses a semantic dialog.
- Score/time/health have an `aria-live` semantic summary, throttled by React snapshots rather than every frame.
- Gameplay keyboard capture exists only while GameScreen is mounted.
- Touch controls are multi-pointer compatible and overlaid on the landscape arena.

## E2E/performance evidence status

The repository contains the Playwright suite, deterministic seed hook, explicit simulation-time hook and HTML-report configuration. Visual snapshot assertions are part of the test plan; actual baseline PNGs and empirical profiling numbers must be generated from a successfully installed browser/runtime on the final evaluation machine. They are intentionally not fabricated in source control.

The exact profiling procedure is in `docs/PERFORMANCE.md`.

## Evidence still required before the final submission

The source implementation is prepared for the challenge, but three evaluator-facing artifacts are inherently environment-dependent and must be produced from the final checkout rather than fabricated:

1. Run `npm ci`, `npm run check` and `npm run test:e2e` with Chromium installed; keep the Playwright HTML report and failure traces/screenshots.
2. Approve and commit real Playwright visual baselines for the menu, stable arena and result screen from the final browser/runtime.
3. Profile the optimized build for the required 180-second match and five enter/play/exit cycles; record FPS, p95 frame interval, peak entities, heap/resource behavior, hardware/browser/viewport and limitations.
4. Deploy this exact final commit and verify that direct load + refresh work and that MSW ranking/history still operate on the public URL.

These are the only items this repository intentionally does not claim to have measured in this environment.
