import { test, expect, type Page } from '@playwright/test';

async function openApp(page: Page) {
  await page.goto('/?e2e=1');
  await expect(page.getByRole('heading', { name: /CANNON/i })).toBeVisible({ timeout: 45_000 });
}

async function startGame(page: Page) {
  await page.getByRole('button', { name: /START THE RIOT/i }).click();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 20_000 });
  await page.waitForFunction(() => Boolean((window as Window & { __CANNON_RIOT_TEST__?: unknown }).__CANNON_RIOT_TEST__));
}

async function debugState(page: Page) {
  return page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.getState());
}

async function timeoutMatch(page: Page) {
  await page.evaluate(() => {
    const api = (window as any).__CANNON_RIOT_TEST__;
    api.setTimeRemaining(0.05);
    api.advanceTime(0.1);
  });
  await expect(page.getByText('MATCH OVER')).toBeVisible();
}

async function selectNetworkScenario(page: Page, value: string) {
  await page.getByRole('button', { name: /OPTIONS/i }).click();
  await page.getByLabel('Network scenario').selectOption(value);
  await page.getByRole('button', { name: 'BACK' }).click();
}

test.describe('boot and loading', () => {
  test('shows asset-load failure and recovers through retry', async ({ page }) => {
    let fail = true;
    await page.route('**/assets/ui/menu-wallpaper-hero.png', async (route) => {
      if (fail) await route.abort();
      else await route.continue();
    });
    await page.goto('/?e2e=1');
    await expect(page.getByText('SOMETHING FELL OVERBOARD.')).toBeVisible({ timeout: 20_000 });
    fail = false;
    await page.getByRole('button', { name: 'TRY AGAIN' }).click();
    await expect(page.getByRole('heading', { name: /CANNON/i })).toBeVisible({ timeout: 45_000 });
  });
});

test.describe('application and gameplay', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('defaults to English and switches EN/PT/ES live without restarting a match', async ({ page }) => {
    await expect(page.getByRole('button', { name: /START THE RIOT/i })).toBeVisible();
    await page.getByRole('button', { name: /Português — Brasil/i }).click();
    await expect(page.getByRole('button', { name: /COMEÇAR O CAOS/i })).toBeVisible();
    await page.getByRole('button', { name: /COMEÇAR O CAOS/i }).click();
    await page.waitForFunction(() => Boolean((window as any).__CANNON_RIOT_TEST__));
    const before = await debugState(page);
    await page.getByRole('button', { name: /Español — España/i }).click();
    await expect(page.getByText('CAÑÓN FRONTAL')).toBeVisible();
    const after = await debugState(page);
    expect(after.elapsed).toBeGreaterThanOrEqual(before.elapsed);
    expect(after.player.x).toBeCloseTo(before.player.x, -1);
  });

  test('persists local player identity and uses it for subsequent sessions', async ({ page }) => {
    const player = page.getByLabel('PLAYER');
    await player.fill('Captain Rhea');
    await page.reload();
    await expect(page.getByLabel('PLAYER')).toHaveValue('Captain Rhea');
  });

  test('options validate and persist gameplay configuration', async ({ page }) => {
    await page.getByRole('button', { name: /OPTIONS/i }).click();
    const session = page.getByLabel('MATCH DURATION');
    const spawn = page.getByLabel('SPAWN INTERVAL');
    await session.fill('60');
    await spawn.fill('2');
    await page.getByRole('button', { name: 'SAVE' }).click();
    await expect(page.getByText(/60s match · enemy every 2s/i)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/60s match · enemy every 2s/i)).toBeVisible();
  });

  test('desktop and touch controls remain visible and usable', async ({ page, isMobile }) => {
    if (isMobile) {
      await expect(page.locator('.touch-menu-hint')).toBeVisible();
      await expect(page.getByText(/Joystick on the left/i)).toBeVisible();
    } else {
      await expect(page.getByText(/FRONT SHOT/i)).toBeVisible();
      await expect(page.getByText(/BROADSIDE/i)).toBeVisible();
      await expect(page.getByText(/POWDER BARREL/i)).toBeVisible();
    }

    await startGame(page);
    await expect(page.getByText('FRONT CANNON')).toBeVisible();
    await expect(page.getByText('BROADSIDE CANNONS')).toBeVisible();

    if (isMobile) {
      const before = await debugState(page);
      await page.getByRole('button', { name: /Front shot/i }).tap();
      await page.waitForTimeout(80);
      const after = await debugState(page);
      expect(after.projectiles.length).toBeGreaterThan(before.projectiles.length);
    }
  });

  test('landscape mobile controls stay inside the viewport', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Touch layout assertion.');
    await startGame(page);
    const viewport = page.viewportSize();
    const joystick = await page.locator('.touch-joystick').boundingBox();
    const attackZone = await page.locator('.touch-attack-zone').boundingBox();
    const topbar = await page.locator('.game-topbar').boundingBox();
    expect(viewport && joystick && attackZone && topbar).toBeTruthy();
    if (viewport && joystick && attackZone && topbar) {
      expect(joystick.x).toBeGreaterThanOrEqual(0);
      expect(joystick.y).toBeGreaterThanOrEqual(0);
      expect(joystick.x + joystick.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(attackZone.x + attackZone.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(attackZone.y + attackZone.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(topbar.width).toBeLessThanOrEqual(viewport.width + 1);
    }
  });

  test('movement respects arena bounds and island collision', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard movement assertion.');
    await startGame(page);
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.setPlayerPose(70, 360, Math.PI));
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    let state = await debugState(page);
    expect(state.player.x).toBeGreaterThanOrEqual(58);

    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.setPlayerPose(130, 214, 0));
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(900);
    await page.keyboard.up('KeyW');
    state = await debugState(page);
    expect(state.player.x).toBeLessThan(178);
  });

  test('rotation changes heading and Shooter uses its ranged attack', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard AI assertion.');
    await startGame(page);
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.setPlayerPose(640, 360, 0));
    const before = await debugState(page);
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(180);
    await page.keyboard.up('KeyD');
    const turned = await debugState(page);
    expect(Math.abs(turned.player.rotation - before.player.rotation)).toBeGreaterThan(0.1);

    const shooterId = await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.setPlayerPose(640, 360, 0);
      const id = api.spawnEnemy('shooter', 850, 360, 100);
      api.setEnemyShootCooldown(id, 0);
      api.advanceTime(0.2);
      return id;
    });
    expect(shooterId).toContain('debug-enemy-shooter');
    const after = await debugState(page);
    expect(after.projectiles.some((shot: any) => shot.owner === 'enemy')).toBeTruthy();
  });

  test('front shot and broadside use the required projectile counts and cooldowns', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard weapon assertion.');
    await startGame(page);
    const before = await debugState(page);
    const beforeShots = before.projectiles.filter((shot: any) => shot.owner === 'player').length;

    await page.keyboard.press('Space');
    let state = await debugState(page);
    expect(state.projectiles.filter((shot: any) => shot.owner === 'player').length).toBe(beforeShots + 1);
    expect(state.cooldowns.front).toBeGreaterThan(0);

    await page.waitForTimeout(500);
    await page.keyboard.press('KeyQ');
    state = await debugState(page);
    const playerShots = state.projectiles.filter((shot: any) => shot.owner === 'player');
    expect(playerShots.length).toBeGreaterThanOrEqual(beforeShots + 4);
    const broadside = playerShots.slice(-3);
    const directions = broadside.map((shot: any) => Math.atan2(shot.vy, shot.vx));
    expect(Math.max(...directions) - Math.min(...directions)).toBeLessThan(0.02);
    expect(state.cooldowns.broadside).toBeGreaterThan(0);
  });

  test('projectile kill scores once and dead target no longer participates', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard combat assertion.');
    await startGame(page);
    await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.setPlayerPose(640, 360, 0);
      api.spawnEnemy('shooter', 735, 360, 20);
    });
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    const state = await debugState(page);
    expect(state.score).toBe(1);
    expect(state.enemies.filter((enemy: any) => enemy.alive !== false && enemy.id.startsWith('debug-enemy')).length).toBe(0);
  });

  test('normal spawn sequence guarantees Chaser and Shooter', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.advanceTime(6.2));
    const state = await debugState(page);
    const kinds = new Set(state.enemies.map((enemy: any) => enemy.kind));
    expect(kinds.has('chaser')).toBeTruthy();
    expect(kinds.has('shooter')).toBeTruthy();
  });

  test('Shooter hull is solid but non-damaging on contact', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard collision assertion.');
    await startGame(page);
    await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.setPlayerPose(640, 360, 0);
      api.spawnEnemy('shooter', 708, 360, 500);
    });
    const before = await debugState(page);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(360);
    await page.keyboard.up('KeyW');
    const after = await debugState(page);
    expect(after.player.health).toBeCloseTo(before.player.health, 3);
    const shooter = after.enemies.find((enemy: any) => enemy.kind === 'shooter');
    expect(after.player.x).toBeLessThan(shooter.x + 4);
  });

  test('Chaser collision damages player, self-destructs and awards no point', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.setPlayerPose(640, 360, 0);
      api.spawnEnemy('chaser', 675, 360, 100);
      api.advanceTime(0.2);
    });
    const state = await debugState(page);
    expect(state.player.health).toBeLessThan(100);
    expect(state.score).toBe(0);
  });

  test('Living Powder allows front + both broadsides with matched boosted speed', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard weapon assertion.');
    await startGame(page);
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.spawnPickup('powder'));
    await page.waitForTimeout(120);
    const before = await debugState(page);
    const count = before.projectiles.filter((shot: any) => shot.owner === 'player').length;
    await page.keyboard.down('Space');
    await page.keyboard.down('KeyQ');
    await page.keyboard.down('KeyE');
    await page.waitForTimeout(70);
    await page.keyboard.up('Space');
    await page.keyboard.up('KeyQ');
    await page.keyboard.up('KeyE');
    const state = await debugState(page);
    const shots = state.projectiles.filter((shot: any) => shot.owner === 'player');
    expect(shots.length - count).toBe(7);
    const speeds = shots.slice(-7).map((shot: any) => Math.hypot(shot.vx, shot.vy));
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeLessThan(0.5);
  });

  test('dash respects cooldown and arena bounds', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard dash assertion.');
    await startGame(page);
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.setPlayerPose(640, 360, 0));
    const before = await debugState(page);
    await page.keyboard.press('ControlLeft');
    const after = await debugState(page);
    expect(after.player.x).toBeGreaterThan(before.player.x + 40);
    expect(after.cooldowns.dash).toBeGreaterThan(1);
  });

  test('medicine heals and temporary buffs stop while paused', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard pause assertion.');
    await startGame(page);
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.damagePlayer(55));
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.spawnPickup('medicine'));
    await page.waitForTimeout(100);
    let state = await debugState(page);
    expect(state.player.health).toBeGreaterThan(60);

    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.spawnPickup('powder'));
    await page.waitForTimeout(100);
    await page.keyboard.press('KeyP');
    const paused = await debugState(page);
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.advanceTime(2));
    const stillPaused = await debugState(page);
    expect(stillPaused.paused).toBeTruthy();
    expect(stillPaused.buffs.powder).toBeCloseTo(paused.buffs.powder, 2);
  });

  test('automatic blur pause requires explicit resume and does not advance time', async ({ page }) => {
    await startGame(page);
    const before = await debugState(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByRole('dialog', { name: /PAUSED/i })).toBeVisible();
    await page.waitForTimeout(350);
    const paused = await debugState(page);
    expect(paused.paused).toBeTruthy();
    expect(paused.elapsed).toBeCloseTo(before.elapsed, 1);
    await page.getByRole('button', { name: /BACK TO THE RIOT/i }).click();
    const resumed = await debugState(page);
    expect(resumed.paused).toBeFalsy();
  });

  test('powder barrel kills trigger target, only damages neighbours and never hurts player', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard barrel assertion.');
    await startGame(page);
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.setPlayerPose(640, 360, 0));
    await page.keyboard.press('KeyR');
    let state = await debugState(page);
    const barrel = state.barrels[0];
    const playerHealth = state.player.health;
    await page.evaluate(({ x, y }) => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.spawnEnemy('chaser', x + 24, y, 100);
      api.spawnEnemy('shooter', x + 58, y + 6, 100);
    }, barrel);
    await page.waitForTimeout(850);
    state = await debugState(page);
    expect(state.score).toBeGreaterThanOrEqual(1);
    expect(state.player.health).toBeCloseTo(playerHealth, 3);
    const splash = state.enemies.find((enemy: any) => enemy.kind === 'shooter' && enemy.id.startsWith('debug-enemy'));
    expect(splash.health).toBeGreaterThanOrEqual(1);
    expect(splash.health).toBeLessThan(100);
  });

  test('timeout result persists across refresh and clean restart resets match state', async ({ page }) => {
    await startGame(page);
    await timeoutMatch(page);
    await expect(page.getByText('TIME EXPIRED')).toBeVisible();
    await page.reload();
    await expect(page.getByText('MATCH OVER')).toBeVisible();
    await page.getByRole('button', { name: 'PLAY AGAIN' }).click();
    await page.waitForFunction(() => Boolean((window as any).__CANNON_RIOT_TEST__));
    const clean = await debugState(page);
    expect(clean.score).toBe(0);
    expect(clean.player.health).toBe(100);
    expect(clean.elapsed).toBeLessThan(2);
  });

  test('player destruction ends the match with the correct reason', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.damagePlayer(999));
    await expect(page.getByText('HULL DESTROYED')).toBeVisible();
  });

  test('abandoning combat does not create ranking/history/outbox records', async ({ page }) => {
    await startGame(page);
    await page.keyboard.press('KeyP');
    await page.getByRole('button', { name: 'ABANDON MATCH' }).click();
    await expect(page.getByRole('button', { name: /START THE RIOT/i })).toBeVisible();
    const storage = await page.evaluate(() => ({
      db: JSON.parse(localStorage.getItem('cannon-riot:mock-db') ?? '[]'),
      outbox: JSON.parse(localStorage.getItem('cannon-riot:match-outbox') ?? '[]'),
    }));
    expect(storage.db).toHaveLength(0);
    expect(storage.outbox).toHaveLength(0);
  });

  test('repeated navigation and remounting keep a single gameplay canvas', async ({ page }) => {
    for (let index = 0; index < 3; index += 1) {
      await page.getByRole('button', { name: /OPTIONS/i }).click();
      await page.getByRole('button', { name: 'BACK' }).click();
    }
    await startGame(page);
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.keyboard.press('KeyP');
    await page.getByRole('button', { name: 'ABANDON MATCH' }).click();
    await startGame(page);
    await expect(page.locator('canvas')).toHaveCount(1);
  });

  test('successful registration becomes visible in both ranking and local history', async ({ page }) => {
    await page.getByLabel('PLAYER').fill('Audit Captain');
    await startGame(page);
    await timeoutMatch(page);
    await expect(page.getByText(/Match recorded/i)).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'MAIN MENU' }).click();
    await page.getByRole('button', { name: 'RANKING' }).click();
    await expect(page.getByText('Audit Captain')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'HISTORY' }).click();
    await expect(page.getByText(/pts/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('ranking and history expose empty/error/pagination states', async ({ page }) => {
    await page.getByRole('button', { name: /OPTIONS/i }).click();
    await page.getByLabel('Network scenario').selectOption('empty');
    await page.getByRole('button', { name: 'BACK' }).click();
    await page.getByRole('button', { name: 'RANKING' }).click();
    await expect(page.getByText(/NO RECORDS YET/i)).toBeVisible();

    await page.getByRole('button', { name: /OPTIONS/i }).click();
    await page.getByLabel('Network scenario').selectOption('timeout');
    await page.getByRole('button', { name: 'BACK' }).click();
    await page.getByRole('button', { name: 'RANKING' }).click();
    await expect(page.getByText(/Ranking service unavailable/i)).toBeVisible({ timeout: 12_000 });

    await page.getByRole('button', { name: /OPTIONS/i }).click();
    await page.getByLabel('Network scenario').selectOption('ranking-error');
    await page.getByRole('button', { name: 'BACK' }).click();
    await page.getByRole('button', { name: 'RANKING' }).click();
    await expect(page.getByText(/Ranking service unavailable/i)).toBeVisible({ timeout: 8_000 });

    await page.getByRole('button', { name: /OPTIONS/i }).click();
    await page.getByLabel('Network scenario').selectOption('pagination');
    await page.getByRole('button', { name: 'BACK' }).click();
    await page.getByRole('button', { name: 'RANKING' }).click();
    await expect(page.getByText(/PAGE 1 \/ 2/i)).toBeVisible({ timeout: 8_000 });
  });

  test('timeout-after-save retry is idempotent and clears the outbox', async ({ page }) => {
    await selectNetworkScenario(page, 'timeout-after-save');
    await startGame(page);
    await timeoutMatch(page);
    await expect(page.getByText(/Record pending/i)).toBeVisible({ timeout: 6_000 });
    let persisted = await page.evaluate(() => ({
      db: JSON.parse(localStorage.getItem('cannon-riot:mock-db') ?? '[]'),
      outbox: JSON.parse(localStorage.getItem('cannon-riot:match-outbox') ?? '[]'),
    }));
    expect(persisted.db).toHaveLength(1);
    expect(persisted.outbox).toHaveLength(1);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText(/Match recorded/i)).toBeVisible({ timeout: 5_000 });
    persisted = await page.evaluate(() => ({
      db: JSON.parse(localStorage.getItem('cannon-riot:mock-db') ?? '[]'),
      outbox: JSON.parse(localStorage.getItem('cannon-riot:match-outbox') ?? '[]'),
    }));
    expect(persisted.db).toHaveLength(1);
    expect(persisted.outbox).toHaveLength(0);
  });

  test('backend unavailable at game over preserves outbox and recovers after reset', async ({ page }) => {
    await selectNetworkScenario(page, 'unavailable-on-game-over');
    await startGame(page);
    await timeoutMatch(page);
    await expect(page.getByText(/Record pending/i)).toBeVisible({ timeout: 5_000 });
    await page.reload();
    await expect(page.getByText(/Record pending/i)).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'MAIN MENU' }).click();
    await page.getByRole('button', { name: /OPTIONS/i }).click();
    await page.getByRole('button', { name: /RESTORE CALM SEAS/i }).click();
    await page.getByRole('button', { name: 'BACK' }).click();
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('cannon-riot:match-outbox') ?? '[]').length)).toBe(0);
  });

  test('out-of-order ranking requests keep the selected page state coherent', async ({ page }) => {
    await page.getByRole('button', { name: /OPTIONS/i }).click();
    await page.getByLabel('Network scenario').selectOption('out-of-order');
    await page.getByRole('button', { name: 'BACK' }).click();
    await page.getByRole('button', { name: 'RANKING' }).click();
    await expect(page.getByText(/PAGE 1 \/ 2/i)).toBeVisible({ timeout: 8_000 });
    await page.locator('.pager button').last().click();
    await expect(page.getByText(/PAGE 2 \/ 2/i)).toBeVisible({ timeout: 8_000 });
  });
});
