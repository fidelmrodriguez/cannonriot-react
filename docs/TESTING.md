# Testing

## Playwright setup

Playwright runs the same production-build application in two Chromium projects:

- `desktop-chromium` — Desktop Chrome profile;
- `mobile-chromium` — Pixel 7 device profile, `915×412`, touch enabled and landscape viewport.

The web server command is `npm run build && npm run preview`. Failures retain traces and screenshots; the HTML report is written to `playwright-report/`.

```bash
npm ci
npx playwright install chromium
npm run test:e2e
npm run test:e2e:report
```

## Determinism and test API

Opening with `?e2e=1` fixes the gameplay seed at `1337` and exposes `window.__CANNON_RIOT_TEST__` only while GameScreen is mounted.

Available helpers:

- `getState()`;
- `damagePlayer(amount)`;
- `spawnPickup(kind)`;
- `spawnEnemy(kind, x, y, health?)`;
- `setEnemyShootCooldown(id, seconds)`;
- `setPlayerPose(x, y, rotation?)`;
- `advanceTime(seconds)`;
- `setTimeRemaining(seconds)`.

`advanceTime()` calls the real engine tick path at fixed 1/30 s steps. The helpers prepare/observe state; they do not replace collision, damage, AI, weapon or scoring code.

## Current automated coverage

`tests/e2e/app.spec.ts` currently covers:

1. boot asset failure and visible retry recovery;
2. default English + live EN/PT/ES switching during a running match;
3. persistent local player identity;
4. options validation/persistence;
5. desktop controls and touch D-pad/artillery controls, including one-thumb diagonal forward + left/right steering and multitouch combinations;
6. touch controls/HUD staying inside the landscape viewport;
7. movement bounds and island collision;
8. rotation and Shooter ranged attack;
9. front/broadside projectile counts, parallel directions, cooldowns and the 0.25 s weapon-switch lock;
10. projectile kill scoring exactly once;
11. normal spawn sequence containing both Chaser and Shooter;
12. solid/non-damaging Shooter hull contact;
13. Chaser collision damage + non-scoring self-destruction;
14. Living Powder automatic front + both-broadside fire and automatic stop on expiry;
15. dash active i-frame, Chaser counter and immediate return to vulnerability after dash;
16. ≤35% hull emergency Medicine/Armor drop and cooldown;
17. Medicine healing and paused buff timers;
18. blur pause requiring explicit resume without time advance;
19. powder-barrel trigger kill, expanded non-lethal splash and player self-immunity;
20. timeout result persistence and clean restart;
21. player-death result reason;
22. abandoned match not creating DB/outbox records;
23. repeated navigation/remounting keeping a single gameplay canvas;
24. successful registration becoming visible in ranking and local history;
25. ranking/history empty, timeout/error and pagination states;
26. timeout-after-save idempotent retry;
27. unavailable-at-game-over outbox persistence/recovery;
28. out-of-order ranking requests preserving the selected page.

The mobile selectors target the current D-pad UI; the suite no longer expects the removed virtual joystick and includes regression coverage for one-thumb diagonal steering.

## Network isolation and state

Tests open the app with `?e2e=1`, which also exposes the developer network-scenario UI. MSW fixtures/state live in browser `localStorage`. Individual flows are written so their expected records/scenarios are explicit; when adding new tests, prefer a fresh browser context or clear the relevant local keys to avoid coupling.

## Visual regression status

The challenge requires versioned visual regression baselines for the menu, a stable arena state and the result screen. The current Playwright file does **not** yet contain committed `toHaveScreenshot` baselines.

Before final submission, add/approve those baselines from the final browser/runtime rather than generating them merely to silence a regression:

```bash
npm run test:e2e:update
```

## Final verification checklist

From a clean checkout with Node 22 and Playwright Chromium installed:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Keep the HTML report plus retained traces/screenshots for any failures. Empirical performance evidence is tracked separately in `docs/PERFORMANCE.md`.
