# Testing

## Playwright setup

Playwright runs Chromium in two projects:

- desktop Chromium;
- landscape touch/mobile Chromium.

Failures retain traces and screenshots. The HTML reporter writes to `playwright-report/`.

```bash
npm ci
npx playwright install chromium
npm run build
npm run test:e2e
npm run test:e2e:report
```

## Determinism

`?e2e=1` fixes the gameplay seed to `1337`. The test-only API exposes:

- `getState()`;
- `damagePlayer(amount)`;
- `spawnPickup(kind)`;
- `spawnEnemy(kind, x, y, health?)`;
- `setPlayerPose(x, y, rotation?)`;
- `advanceTime(seconds)`.

These hooks set up/observe state but still execute the real movement, combat, collision, AI and timing code.

## Challenge coverage map

1. Navigation/options validation/persistence — options E2E.
2. Asset loading/error/retry — route-failure test plan for boot/game loader.
3. Match start/movement/rotation/bounds/islands — movement tests + debug pose setup.
4. Front/broadside/damage/cooldown/scoring — projectile count, parallel direction, cooldown and barrel/combat tests.
5. Chaser/Shooter/spawn interval — AI tests and deterministic type sequence.
6. Timeout/death/end freeze/restart — controlled simulation clock + damage hook.
7. Pause/blur/resume — pause tests; input is cleared by engine.
8. Result display + refresh persistence — result-resume storage flag.
9. Abandon/repeated navigation/touch — no completion callback on unmount; touch project.
10. Ranking/history pagination/loading/empty/error — MSW scenario tests.
11. Registration/update/recovery after refresh — persistent array outbox + mutation invalidation.
12. Retry after timeout/no duplicate/out-of-order — stable `matchId`, idempotent handler, `AbortSignal` to Axios.

## Visual regression

The suite should contain `toHaveScreenshot` assertions for:

- main menu;
- stable arena state with fixed seed;
- result screen.

Generate/update baselines only after visually approving the reference render:

```bash
npm run test:e2e:update
```

Baseline PNGs must be committed after generation on the final browser/runtime. Do not update snapshots just to silence a regression.

## Isolation

Each test should reset localStorage/mock state or use a fresh browser context. Network scenarios are selected through the same UI/localStorage path used in the demonstration build.
