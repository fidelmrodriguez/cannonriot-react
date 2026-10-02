# Cannon Riot

Cannon Riot is a top-down 2D naval arena shooter built for the **React & PixiJS — Pirate Battle** technical challenge. React owns application UI and remote-data screens; PixiJS owns the real-time combat arena. TypeScript runs in strict mode, Axios + TanStack Query consume REST endpoints mocked by MSW, and Playwright covers the browser flows.

> Portuguese documentation: [README.pt-BR.md](README.pt-BR.md)

## Netlify

https://cannonriot-react.netlify.app/

## Run locally

Requirements:

- Node.js 22 LTS
- npm

```bash
npm ci
npm run dev
```

Windows users can run `start-windows.bat`.

There are no required environment variables. Ranking and match history are simulated in-browser by MSW in development, preview and deployed builds.

## Commands

```bash
npm run dev              # Vite development server
npm run build            # strict TypeScript projects + production Vite build
npm run preview          # preview the production build
npm run lint             # repository hygiene checks
npm run typecheck        # strict TypeScript verification
npm run test:e2e         # Playwright Chromium suite (desktop + mobile)
npm run test:e2e:ui      # Playwright UI mode
npm run test:e2e:update  # update visual baselines intentionally
npm run test:e2e:report  # open the HTML report
npm run check            # lint + typecheck + production build
```

Install Playwright's browser once when needed:

```bash
npx playwright install chromium
```

## Controls

### Keyboard

| Action | Control |
| --- | --- |
| Move forward | `W` / `Arrow Up` |
| Turn left/right | `A` / `D` or arrow keys |
| Front cannon | `Space` |
| Left/right broadside | `Q` / `E` |
| Dash | `Ctrl` |
| Powder barrel | `R` |
| Pause/resume | `P` / `Esc` |

### Touch

Touch devices use a virtual helm on the left and artillery controls on the right. Movement and firing can be held simultaneously. The supported game orientation is landscape. When the browser can lock orientation, the app requests landscape after a user gesture; otherwise the touch shell preserves a horizontal game viewport.

## Player identity

The challenge requires player identification in ranking/history but does not define authentication or account registration. Cannon Riot therefore creates a persistent local `playerId` once and exposes an editable display name in the main menu before play. Completed matches snapshot both values. No login or external identity provider is involved.

## Gameplay rules

The authoritative world is a fixed 1280×720 arena. Resizing only changes presentation scale.

- The player moves forward and rotates left/right.
- The front weapon fires one projectile.
- Each broadside fires three parallel projectiles.
- Chasers pursue and self-destruct on player collision; that self-destruction gives no point.
- Shooters approach, seek line of sight, keep combat distance and fire at the player.
- Islands and arena bounds block ships; islands also block projectiles.
- Each projectile can apply damage once, then is removed on hit, obstacle, expiry or arena exit.
- Every enemy destroyed by player attacks awards exactly one point.
- A match ends when active simulation time expires or player hull reaches zero.
- Manual pause, blur and hidden-tab pause suspend simulation/cooldowns. Resume always requires player action.
- Restart creates a clean engine instance and a new match id/seed.

The default match is 120 seconds with a 3-second enemy spawn interval. Options expose the challenge-required ranges: 60–180 seconds and 1–8 seconds.

## Extra arcade mechanics

Dash, repair crates, temporary powerups and powder barrels are additive mechanics. They do not change the required one-point scoring rule. Adaptive support is derived only from the selected session duration and spawn interval, so extreme configurations remain playable without silently changing leaderboard keys.

See [docs/GAMEPLAY-BALANCE.md](docs/GAMEPLAY-BALANCE.md).

## Match configuration and ranking comparability

A match receives a `structuredClone` snapshot of the current gameplay configuration when it starts. Changing Options later cannot mutate a running match.

Ranking comparability is deliberately limited to the two player-editable challenge parameters:

```ts
{
  sessionTime,
  enemySpawnTime,
}
```

A 120s / 3s match never competes directly with a 180s / 1s match. Every confirmed match is a ranking entry. Ranking order is score descending, effective duration ascending, played-at timestamp ascending, then match id for a deterministic final tie-break.

## Match records, idempotency and recovery

A completed match has a UUID generated before the request. The record contains match/player identity, timestamp, score, effective simulation duration, end reason, configuration snapshot and seed.

Before the POST request, the match is added to a local **outbox**. The outbox is an array, not a single pending slot, so one failed submission never blocks another match. Successful submissions remove only their own `matchId` from the outbox.

MSW treats `matchId` as idempotent: a retry after a timeout returns the already stored record instead of inserting a duplicate. Pending entries survive refresh. Cannon Riot retries the outbox on application startup and again when returning to the main menu, which makes the “backend unavailable at game over → restore network → recover” path reproducible.

Abandoned matches never enter the outbox, ranking or history.

## TanStack Query and Axios

- Ranking key: configuration + page.
- History key: local `playerId` + page.
- Axios receives TanStack Query's `AbortSignal`, so cancelled/obsolete requests stop at the HTTP client.
- Ranking and history are invalidated after a successful match registration.
- Queries refetch when their tab is shown again.
- Loading, empty and error states are rendered explicitly.
- Background cache behavior is delegated to TanStack Query instead of manual component state.

## Network scenarios

The network-scenario controls are intentionally hidden from the normal player-facing UI. Open the app with `?dev=1` (or `?e2e=1` in automated tests), then use **Options → Network Scenario**. The selectable MSW scenarios are:

- normal success;
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
- timeout after the server stored the match;
- backend unavailable at game over.

**Restore calm seas** resets both the scenario and the mock database. The client outbox is intentionally preserved so recovery can be demonstrated after restoring the network.

See [docs/NETWORK-SCENARIOS.md](docs/NETWORK-SCENARIOS.md).

## Internationalization

English is the first-run/default language to satisfy the challenge requirement that the solution UI be in English. Portuguese and Spanish are optional live translations. The global language controls use country-flag artwork for the United States, Brazil and Spain, are available from the first loading screen and remain available during gameplay. Changing language does not recreate the PixiJS engine.

## Architecture

The project keeps continuous combat state inside `GameEngine`; React receives throttled snapshots instead of frame-by-frame state. Input is isolated in `InputManager`; balance is centralized in typed config; render assets and runtime entity types are separate modules. Strict Mode cleanup destroys the Pixi application, detaches keyboard/visibility listeners, disconnects resize observers and removes ticker callbacks.

See [ARCHITECTURE.md](ARCHITECTURE.md).

## Tests

Playwright is configured for Chromium desktop and a landscape touch profile. The E2E suite uses a fixed seed (`?e2e=1`) and an explicit test-only simulation clock hook while keeping real gameplay rules, collisions and input paths.

Coverage is mapped to every challenge testing category in [docs/TESTING.md](docs/TESTING.md).

## Performance

The renderer caps device pixel ratio at 2, clamps simulation delta time, limits enemy density in extreme spawn configurations, budgets visual particles, reuses preloaded textures and removes transient ticker callbacks when effects expire.

The challenge also asks for empirical optimized-build profiling (3-minute match + five enter/play/exit cycles). The exact procedure and evidence fields are in [docs/PERFORMANCE.md](docs/PERFORMANCE.md). Runtime numbers must be recorded on the machine/browser used for the final submission rather than invented.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/CHALLENGE-COMPLIANCE.md](docs/CHALLENGE-COMPLIANCE.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/NETWORK-SCENARIOS.md](docs/NETWORK-SCENARIOS.md)
- [docs/GAMEPLAY-BALANCE.md](docs/GAMEPLAY-BALANCE.md)
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md)
- [docs/ASSETS.md](docs/ASSETS.md)
- [docs/ART-DIRECTION.md](docs/ART-DIRECTION.md)
- [docs/THIRD-PARTY-NOTICES.txt](docs/THIRD-PARTY-NOTICES.txt)

Portuguese mirrors live under `docs/pt-BR/` plus `README.pt-BR.md` and `ARCHITECTURE.pt-BR.md`.
