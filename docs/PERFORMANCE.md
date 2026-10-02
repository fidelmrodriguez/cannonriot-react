# Performance profiling

## Runtime safeguards already implemented

- DPR capped at 2;
- world fixed at 1280×720 and CSS-scaled instead of rebuilding world coordinates;
- simulation delta clamped;
- active-enemy cap under aggressive spawn settings;
- particle budget for projectile spark clutter;
- preloaded/reused Pixi textures;
- transient ticker callbacks remove themselves;
- React snapshots throttled instead of per-frame state updates;
- engine/listeners/ResizeObserver destroyed on unmount.

## Required empirical run

The challenge requires real measurements from an optimized build. Run:

```bash
npm ci
npm run build
npm run preview
```

Record the following for a 180-second match:

```text
Hardware:
OS:
Browser + version:
Viewport / DPR:
Session time: 180s
Enemy spawn interval:
Average FPS:
P95 frame interval (ms):
Peak entity count:
Notes:
```

Then perform five complete cycles of enter → play → exit and record heap/resource behavior:

```text
Cycle 1 heap:
Cycle 2 heap:
Cycle 3 heap:
Cycle 4 heap:
Cycle 5 heap:
Continuous growth observed? yes/no
Investigation/notes:
```

Use browser Performance/Memory tooling on the production preview. Store screenshots/exported traces in `reports/` before final submission.

## Why no invented numbers are committed

Performance values depend on hardware, browser, viewport and runtime. This repository documents the exact procedure and code safeguards; empirical figures should be captured on the final submission environment rather than fabricated.
