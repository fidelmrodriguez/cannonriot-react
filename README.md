# Cannon Riot

Cannon Riot is a top-down 2D naval arena shooter built for the **React & PixiJS — Pirate Battle** technical challenge. React owns application UI and remote-data screens; PixiJS owns the real-time combat arena. The codebase uses strict TypeScript, Axios + TanStack Query for REST data, MSW for the browser API simulation, and Playwright for E2E coverage.

> Portuguese documentation: [README.pt-BR.md](README.pt-BR.md)

## Public build

https://cannonriot-react.netlify.app/

## Run locally

Requirements:

- Node.js 22 (`.nvmrc` and `package.json` both target Node 22)
- npm

```bash
npm ci
npm run dev
```

There are no required environment variables. Ranking and match history are simulated in-browser by MSW in development, preview, tests and the deployed build.

## Commands

```bash
npm run dev              # Vite development server
npm run build            # strict TypeScript projects + production Vite build
npm run preview          # preview the production build
npm run lint             # repository hygiene checks
npm run typecheck        # strict TypeScript verification
npm run test:e2e         # Playwright Chromium suite
npm run test:e2e:ui      # Playwright UI mode
npm run test:e2e:update  # update visual baselines intentionally
npm run test:e2e:report  # open the HTML report
npm run check            # lint + typecheck + production build
```

Install Playwright Chromium once when needed:

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
| Dash | `F` |
| Powder barrel | `R` |
| Pause/resume | `P` / `Esc` |

### Touch/mobile/tablet

Touch devices use a compact steering D-pad on the left. In addition to **turn left**, **move forward** and **turn right**, dedicated **↖ forward + left** and **↗ forward + right** diagonal zones let one thumb steer and advance at the same time. Dash stays inside the left cluster, while front/left/right cannon controls and the powder-barrel button stay on the right. Each touch contact can own one or more actions, so diagonal steering also coexists with movement + attack multitouch.

The gameplay layout is landscape-first. Touch breakpoints also apply a mobile performance profile without changing simulation rules.

## Gameplay rules

The authoritative world is a fixed **1280×720** arena. Viewport resizing only changes presentation scale.

- Player movement is forward + left/right rotation.
- The front cannon fires one projectile.
- Each broadside fires three parallel projectiles.
- Normal front/broadside fire is separated by a **0.25 s global weapon-switch lock**; quick touch taps can be buffered for **0.32 s**.
- Chasers normally pursue the player and self-destruct on player collision. When a Kraken is nearby they may redirect and ram it instead. A normal collision death does not score; destroying one with an active dash is a scoring player attack.
- Shooters seek ranged positions and line of sight around their current target: normally the player, but a nearby Kraken can draw their fire. Sustained player/Shooter hull friction damages both ships, with substantially more damage applied to the Shooter than to the player.
- Islands and arena bounds block ships; islands also block projectiles.
- Projectiles are single-hit and are removed on hit, obstacle, expiry or arena exit.
- Every enemy destroyed by a scoring player attack awards exactly one point.
- A match ends when active simulation time expires or player hull reaches zero.
- Manual pause, window blur and hidden-tab pause suspend simulation/cooldowns. Resume requires explicit player action.
- Restart creates a clean engine instance and a new match id/seed.

Default configuration: **120 s** match, **3 s** enemy spawn interval. Options expose the challenge ranges: **60–180 s** and **1–8 s**.

## Arcade mechanics and high-pressure balancing

The required challenge rules stay authoritative; these mechanics are additive:

- **Dash**: 0.28 s active movement state. The player is immune to projectile and ship-contact damage only while that state is active. A Chaser destroyed by the dash awards one point and uses dedicated dash-victory lines. There is no post-dash invulnerability.
- **Living Powder**: temporary fully automatic artillery. Front + both broadsides fire whenever their boosted reloads are ready until the buff expires.
- **Wind at Your Back**: increases movement speed, extends dash distance and keeps dash instantly ready with no reload for the entire buff duration.
- **Reinforced Hull**: temporarily reduces incoming damage.
- **Medicine**: repairs hull.
- **Powder Barrel**: up to three active traps; the trigger ship is destroyed and nearby ships inside the **170 px** blast radius take heavy but non-lethal splash damage. The player is immune to their own barrel blast.
- **Emergency support**: at ≤35% hull, if no nearby Medicine/Armor support exists, the game attempts to place a defensive pickup near the player. Emergency drops have a 12 s cooldown and can replace a less useful active pickup when all normal slots are occupied.
- **Spawn alert**: a short `!` telegraph is visual only; newly spawned enemies remain fully active immediately.
- **Shooter hull friction**: while the player hull is rubbing against a purple Shooter, both ships lose health continuously. Shooter friction DPS is intentionally much higher than player friction DPS, so scraping can be used tactically without becoming the optimal attack. Two dedicated chartreuse reaction portraits stay visible during contact and linger briefly after separation.
- **Kraken boss event**: a single neutral-hostile Kraken can enter after 30% of the match. It has 600 HP and a wider health bar, but roaming is now its primary movement behavior: it chooses distant safe-water destinations with a strong preference for another map quadrant, routes around islands and only makes short 2.3–3.2 s opportunistic pursuits when a visible ship comes very close. After a pursuit it must roam for 4.6–6.2 s before chasing again, preventing 1 s enemy spawns from pinning it to one edge of the arena. The Kraken keeps swimming while fighting; its five attack tentacles run on independent staggered timers and can strike visible targets inside 210 px without requiring the body to stop or chase them. Enemy cannon damage against the Kraken is reduced to 55% and Chaser rams deal 24 damage. Nearby enemies may choose it when it is the better local target; enemies actually hit retaliate for 5 s. Only one Kraken can exist at once, with a 7–10 s post-defeat respawn window when enough match time remains. A player kill uses the victory portraits with Kraken-specific lines. Hull contact reuses the angry friction reacts and deals 4.5 HP/s to the player and 18 HP/s to the Kraken; a friction finishing hit counts as a player kill. Defeat uses the same clean explosion VFX as the boats.

Difficulty assistance is derived deterministically from the selected session duration and spawn interval. It changes support cadence, enemy cap and small balance coefficients, but never changes the ranking key or scoring value.

See [docs/GAMEPLAY-BALANCE.md](docs/GAMEPLAY-BALANCE.md).

## Player identity and match records

Authentication is intentionally out of scope. Cannon Riot creates a persistent local `playerId` and exposes an editable display name (maximum 24 characters) in the main menu. Completed matches snapshot both values.

A completed record contains a UUID `matchId`, player identity, timestamp, score, effective simulation duration, end reason, full configuration snapshot and match seed.

## Ranking comparability

The ranking key uses only the two player-editable challenge parameters:

```ts
{
  sessionTime,
  enemySpawnTime,
}
```

A 120 s / 3 s match therefore never competes directly with a 180 s / 1 s match. Ranking order is score descending, duration ascending, played-at timestamp ascending, then match id.

## Registration, idempotency and recovery

Before POSTing a completed match, the client adds it to a persistent local **outbox**. The outbox is an array, so one failed submission does not block another match.

MSW stores confirmed matches by `matchId`; retrying the same id returns the existing record rather than duplicating it. Pending entries survive refresh and are retried during app bootstrap and on menu return. Abandoned matches are never registered.

## TanStack Query, Axios and MSW

- Ranking query key: configuration + page + current network scenario.
- History query key: local `playerId` + page + current network scenario.
- Axios timeout: 3500 ms.
- TanStack Query `AbortSignal` is passed to Axios for ranking/history GETs.
- Successful registration invalidates both ranking and history queries.
- Confirmed mock records are persisted in `localStorage`.

Developer network scenarios are hidden in normal play. Open `?dev=1` (or `?e2e=1`) and use **Options → Network Scenario**. See [docs/NETWORK-SCENARIOS.md](docs/NETWORK-SCENARIOS.md).

## Asset loading and diagnostics

The blocking preloader now starts MSW and loads only **core gameplay textures, the menu scene and SFX**. Reaction portraits, result scenes and non-menu music no longer block entry: portraits are loaded on demand (with low-priority HTTP-cache warming only on capable devices), while battle/result/jukebox music streams when needed. Pixi textures still use a maximum of **3 attempts**, and concurrency is reduced automatically on constrained hardware. Once loading reaches 100%, a **Board the Ship** interaction gate is shown; that explicit gesture unlocks browser audio before the main menu appears. Required-asset failures still emit `[Cannon Riot preload]` diagnostics and an HTTP `HEAD` check.

SFX reuse object URLs; non-menu music is not retained as boot-time blobs. Runtime image URLs are not modified with cache-busting query strings.

See [docs/ASSETS.md](docs/ASSETS.md).

## Internationalization and audio

English is the first-run/default language. Portuguese and Spanish are live alternatives. The fixed language/audio dock remains available across screens and during gameplay. Changing language does not remount the game engine.

The captain idle chirp is reserved for genuine idle reaction panels; mechanic reactions such as dash/pickups use their own action feedback instead of the idle chirp.

## Architecture

Continuous combat state stays inside `GameEngine`; React receives throttled snapshots (about every 80 ms) instead of frame-by-frame state. Input is isolated in `InputManager`, balance is centralized in typed config, and runtime entity types/assets live in separate modules.

See [ARCHITECTURE.md](ARCHITECTURE.md).

## Testing

Playwright is configured for desktop Chromium and a landscape Pixel 7 touch profile. `?e2e=1` fixes the gameplay seed at `1337` and exposes test-only state/time hooks while still exercising the real simulation path.

The current gameplay tests cover the weapon switch lock, Living Powder auto-fire, Shooter/Kraken friction, infinite Wind dash, dash i-frame/scoring counter, the Kraken third-faction flow, emergency support and expanded powder-barrel splash. See [docs/TESTING.md](docs/TESTING.md) for the current suite status and the remaining evaluator-facing evidence.

## Performance

Desktop keeps antialiasing and caps Pixi resolution at device DPR 2. Touch/coarse-pointer devices use a separate visual-performance profile: renderer resolution 1, no Pixi antialiasing, max 50 FPS, fewer water decorations/particles/trails, lower wake frequency and no heavy blur filters. Gameplay timing, AI, damage, collision and spawn rules are unchanged.

See [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/CHALLENGE-COMPLIANCE.md](docs/CHALLENGE-COMPLIANCE.md)
- [docs/GAMEPLAY-BALANCE.md](docs/GAMEPLAY-BALANCE.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/NETWORK-SCENARIOS.md](docs/NETWORK-SCENARIOS.md)
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md)
- [docs/ASSETS.md](docs/ASSETS.md)
- [docs/ART-DIRECTION.md](docs/ART-DIRECTION.md)
- [docs/THIRD-PARTY-NOTICES.txt](docs/THIRD-PARTY-NOTICES.txt)

Portuguese mirrors live under `docs/pt-BR/`, plus `README.pt-BR.md` and `ARCHITECTURE.pt-BR.md`.
