# Performance profiling

## Runtime safeguards already implemented

### Shared simulation/runtime safeguards

- Fixed 1280×720 authoritative world scaled by CSS rather than rebuilding world coordinates.
- Simulation delta clamped to 0.05 s.
- Dynamic active-enemy cap derived from the selected match pressure (bounded to 9–17).
- Visual-particle budgeting with explicit destruction of short-lived graphics.
- Projectile single-hit removal and dead-entity filtering.
- React HUD snapshots throttled to roughly every 80 ms instead of state updates every frame.
- Pixi application, input listeners, visibility/blur listeners and `ResizeObserver` cleaned on engine destruction.
- Reaction portraits optimized to sizes closer to actual in-game presentation to reduce download/decode/GPU pressure.

### Desktop renderer profile

- Standard desktops keep Pixi antialiasing, `min(devicePixelRatio, 2)`, full procedural decoration/effect density and a 120-particle budget.
- Older/limited desktops are detected from hardware hints (`hardwareConcurrency <= 4` or `deviceMemory <= 4 GB`) and automatically use the same reduced rendering profile as touch devices.

### Touch/mobile/tablet renderer profile

Enabled when `(any-pointer: coarse)` matches **or** constrained hardware is detected:

- renderer resolution fixed at 1;
- antialiasing disabled;
- ticker `maxFPS = 50`;
- expensive Pixi `BlurFilter`s skipped;
- caustics reduced 18 → 9;
- reef decorations reduced 11 → 5;
- wavelets reduced 54 → 18;
- ripples reduced 24 → 8;
- visual-particle cap reduced 120 → 48;
- lower projectile-trail probability/budget;
- wake generation interval doubled from 0.055 s to 0.11 s;
- fewer dash streaks/sparks and explosion debris.

This profile changes presentation cost only. The same `GameEngine` simulation still owns movement, AI, timers, spawn, damage, collisions and score.

## Asset-load pressure

The blocking boot now loads only the small core gameplay textures, the menu scene and SFX. Reaction portraits and result scenes no longer gate entry to the menu/game. On capable devices, portrait files are warmed only into the browser HTTP cache one at a time (without Pixi/GPU decoding) and decoded on demand; constrained hardware/network connections skip that cosmetic warmup entirely. Battle/result/jukebox music is streamed when needed instead of being fetched into memory as boot-time blobs.

The three large menu/result wallpapers were converted from PNG to WebP, reducing their combined repository payload from roughly 8.7 MB to about 1.0 MB. The two Kraken react portraits were also resized from 1254×1254 to 640×640 for substantially lower decode/GPU memory pressure.

Blocking-load concurrency adapts to hardware hints (2 workers on constrained devices, up to 3/4 for textures/audio otherwise). Deferred work uses a single worker and yields through `requestIdleCallback`/timeouts; portrait warmup does not decode Pixi textures, so it avoids unnecessary GPU/main-thread memory pressure. Save-Data/2G skips cosmetic warmup entirely; <=4 GB / <=4-core devices warm only the two small Kraken event portraits in HTTP cache and leave the rest fully on demand.

Asset failures remain visible/fatal for required boot assets after three texture attempts; optional/deferred asset failures do not block gameplay and can retry when the asset is actually needed. Console diagnostics still distinguish HTTP/deploy failures from browser decode/runtime failures.

## Required empirical run

The challenge requires real measurements from an optimized build. Run:

```bash
npm ci
npm run build
npm run preview
```

Profile at least the required three-minute match and record:

```text
Hardware:
OS:
Browser + version:
Viewport / DPR:
Input profile: desktop or touch
Session duration: 180s
Enemy spawn interval:
Average FPS:
P95 frame interval (ms):
Peak entity count:
Peak/steady GPU or memory observations:
Notes / limitations:
```

Then complete five enter → play → exit cycles and record resource/heap behavior:

```text
Heap cycle 1:
Heap cycle 2:
Heap cycle 3:
Heap cycle 4:
Heap cycle 5:
Continuous growth observed? yes/no
Investigation / notes:
```

Use browser Performance/Memory tooling against the production preview. Repeat on at least one representative phone/tablet if mobile performance is part of the evaluator demo.

## Evidence policy

No empirical FPS/heap numbers are invented in source control. Performance numbers depend on hardware, browser, viewport, DPR and thermal state. Final submission evidence should record the exact environment and keep exported traces/screenshots/reports with the evaluated commit.
