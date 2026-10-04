# Challenge compliance audit

This document maps the current repository to the public `junglegaming/game-developer-challenge` requirements:

https://github.com/junglegaming/game-developer-challenge

The challenge asks for React UI, strict TypeScript, PixiJS gameplay, TanStack Query, Axios, MSW, Playwright, desktop/mobile support, resilient ranking/history flows and documented performance evidence.

## Stack

| Requirement | Current implementation |
| --- | --- |
| React UI | Menus, Options, jukebox, ranking/history, result, pause dialog, semantic HUD and global controls |
| TypeScript strict | `tsconfig.app.json` uses `strict: true` |
| PixiJS gameplay | Arena, ships, projectiles, islands, health bars, effects, reaction panels |
| TanStack Query | Ranking/history queries and match registration mutation |
| Axios | Ranking/history/match HTTP client with 3500 ms timeout |
| MSW | Browser worker for ranking/history/register endpoints, including published build |
| Playwright | Desktop Chromium + landscape Pixel 7 touch projects |

## Gameplay

Required core behavior is implemented:

- forward movement + left/right rotation;
- front cannon with one projectile;
- left/right broadside commands with three parallel projectiles;
- simultaneous movement + firing through independent input state;
- finite player hull reduced by enemy projectiles and Chaser collision;
- visible arena bounds and island blocking;
- Chaser pursuit/rotation/collision/self-destruction;
- Shooter range/line-of-sight/rotation/projectile behavior;
- deterministic spawn pattern that includes both enemy types;
- configured spawn interval with safe spawn validation;
- projectile direction/speed/damage/lifetime and single-hit removal;
- destroyed enemies stop participating in AI, attacks and collisions;
- 60–180 s active match duration;
- exactly one point per scoring enemy destruction;
- Chaser self-destruction against player remains non-scoring;
- clean timeout/hull-destroyed endings and fresh restart;
- health bars over player/enemies plus React score/time HUD;
- manual + blur/hidden-tab pause with explicit resume;
- firing, impact, explosion and damaged-hull feedback.

Additional mechanics (dash, pickups, Living Powder auto-fire, powder barrel, emergency support) do not change the required ranking key or point value.

## Current combat extensions

The current repository additionally implements:

- 0.25 s normal front/broadside weapon-switch lock + 0.32 s quick-input buffer;
- 0.28 s dash with damage immunity only during the active dash state;
- Chaser dash counter without score;
- Living Powder full automatic front + both broadsides until expiry;
- Medicine, Wind and Reinforced Hull pickups;
- ≤35% hull emergency Medicine/Armor support with 12 s cooldown;
- powder barrel with 170 px non-lethal neighbour splash and player self-immunity;
- visual-only `!` spawn telegraph with no attack delay.

## Screens and configuration

- Main menu: Play, Options, control guidance, Tips, Ranking and History.
- Options: session time + spawn interval with validation/persistence; music/SFX; jukebox link; developer-only network scenario controls.
- Gameplay: Pixi arena, React HUD, pause, desktop and touch controls.
- Result: score, effective duration, end reason, config summary, registration state, Play Again/Main Menu.
- Ranking: player name, score, deterministic rank and pagination for matching config.
- History: local-player records with date, score, duration, end reason, config and pagination.
- Current match receives a cloned configuration snapshot at start.
- Reload/leave during combat abandons without registering.
- Last completed result can be restored after refresh.
- English is the first-run/default UI; PT/ES are optional live translations.

## Typed configuration

Challenge-exposed settings are sanitized through `settings.storage.ts`:

- session time: 60–180 s, 10 s step;
- spawn interval: 1–8 s, 0.5 s step.

Base gameplay constants live in `DEFAULT_CONFIG`; additive arcade tuning lives in `EXTRA_BALANCE`. Balance changes therefore do not require rewriting system logic.

## Architecture and lifecycle

- Continuous combat state remains in `GameEngine`; React receives throttled snapshots.
- Simulation uses delta time with a 0.05 s clamp.
- Pixi canvas preserves a fixed 1280×720 world and uniform viewport scaling.
- Preload runs before normal menu use and exposes visible progress/error/retry.
- Pixi textures are retried up to 3 times and permanent failures produce detailed console/HTTP diagnostics.
- Input/listeners/ticker/`ResizeObserver`/Pixi resources are cleaned on unmount.
- React Strict Mode is supported by create/destroy lifecycle ownership.
- Touch devices use the same simulation plus a visual performance profile; rules do not diverge by device.

## Ranking/history integrity

- Stable UUID `matchId` is created before the request.
- Persistent local player UUID + editable name identify records.
- Effective duration comes from simulation time, excluding pause.
- Ranking compares exactly `sessionTime + enemySpawnTime`.
- Each confirmed `matchId` remains an individual entry; no per-player collapse occurs.
- Tie-break: score desc → duration asc → timestamp asc → match id.
- Ranking query keys include config/page/scenario; history keys include player/page/scenario.
- TanStack Query `AbortSignal` is passed to Axios for GETs.
- Successful registration invalidates ranking and history.
- Persistent array outbox supports multiple pending matches.
- MSW registration is idempotent by `matchId`.
- Pending submissions survive refresh and are retried later.
- A pending submission never blocks another game.

## MSW scenario coverage

Implemented reproducible scenarios:

- normal success;
- empty lists;
- pagination;
- slow response;
- generic timeout;
- deterministic variable latency;
- out-of-order responses;
- connection failure;
- HTTP 422;
- HTTP 503;
- ranking-only failure;
- history-only failure;
- timeout after server save;
- backend unavailable at game over + later recovery.

Scenario controls are available only with `?dev=1`/`?e2e=1`. **Restore calm seas** resets the mock DB/scenario but intentionally preserves the client outbox for recovery demonstrations.

## Responsive/mobile behavior

- Desktop composition is kept separate from touch-only CSS overrides.
- Mobile/tablet menus and remote-data panes can scroll instead of hiding required content.
- Touch gameplay uses left/forward/right steering arrows + dedicated dash on the left and artillery/barrel controls on the right.
- Per-pointer touch tracking supports simultaneous **forward + left/right** steering as well as movement + attack multitouch.
- Touch renderer resolution is 1, antialiasing/expensive blur is disabled, visual density is reduced and ticker is capped at 50 FPS.
- The authoritative arena/HUD remain landscape-oriented and gameplay rules are unchanged.

## Accessibility

- Native buttons/inputs/selects support keyboard navigation.
- Visible focus treatment exists globally.
- Form controls have labels.
- Pause is a semantic `role="dialog"` modal.
- Score/time/hull are mirrored in a throttled `aria-live` summary.
- Gameplay keyboard capture exists only while GameScreen is mounted.
- Language/audio controls have labels/titles and pressed states.

## Automated test status

The current Playwright suite covers the main functional categories plus recent mechanics (weapon lock, Living Powder auto-fire, dash i-frame, emergency support and powder-barrel splash). Mobile assertions are aligned to the current steering-arrow UI.

The repository still needs evaluator-generated evidence that cannot honestly be fabricated in documentation:

1. a clean `npm ci` + `npm run check` + `npm run test:e2e` run with the final checkout and installed Chromium;
2. committed Playwright `toHaveScreenshot` baselines for menu, stable arena and result screen — these are not present yet;
3. empirical optimized-build profiling for the required 180 s match and five enter/play/exit cycles;
4. verification that the deployed URL corresponds to the exact final evaluated commit.

See `docs/TESTING.md` and `docs/PERFORMANCE.md` for the procedures.
