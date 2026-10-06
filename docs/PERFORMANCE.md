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

- Pixi antialiasing enabled.
- Renderer resolution uses `min(devicePixelRatio, 2)`.
- Full procedural decoration/effect density.
- Blur filters used for ocean depth/glow and selected effects.
- Visual-particle cap: 120.

### Touch/mobile/tablet renderer profile

Enabled when `(any-pointer: coarse)` matches:

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

The current idle portraits are 724×543; damage, victory and mechanic portraits are 640×640. They are still larger than their typical ~216 px reaction presentation, but substantially smaller than their previous source-sized versions. The boot loader also limits Pixi texture concurrency to 3.

Asset failures remain visible/fatal to boot after three texture attempts; console diagnostics help distinguish HTTP/deploy failures from browser decode/runtime failures.

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
