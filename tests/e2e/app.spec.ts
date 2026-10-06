import { test, expect, type Page } from '@playwright/test';

async function openApp(page: Page) {
  await page.goto('/?e2e=1');
  const enter = page.getByRole('button', { name: /BOARD THE SHIP/i });
  await expect(enter).toBeVisible({ timeout: 45_000 });
  await enter.click();
  await expect(page.getByRole('heading', { name: /CANNON/i })).toBeVisible({ timeout: 10_000 });
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

async function holdKeysTogether(page: Page, codes: string[], holdMs = 30) {
  await page.evaluate((keys) => {
    for (const code of keys) window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  }, codes);
  await page.waitForTimeout(holdMs);
  await page.evaluate((keys) => {
    for (const code of keys) window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
  }, codes);
}

async function waitForReadyDebugState(page: Page) {
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const api = (window as any).__CANNON_RIOT_TEST__;
    if (!api?.getState) return false;
    try {
      return Boolean(api.getState()?.player);
    } catch {
      return false;
    }
  });
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
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      let failOnce = true;
      window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (failOnce && url.includes('/assets/sounds/cannon_fire_1.wav')) {
          failOnce = false;
          return Promise.resolve(new Response('simulated preload failure', { status: 503 }));
        }
        return originalFetch(input, init);
      }) as typeof window.fetch;
    });
    await page.goto('/?e2e=1');
    await expect(page.getByText('SOMETHING FELL OVERBOARD.')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'TRY AGAIN' }).click();
    const enter = page.getByRole('button', { name: /BOARD THE SHIP/i });
    await expect(enter).toBeVisible({ timeout: 45_000 });
    await enter.click();
    await expect(page.getByRole('heading', { name: /CANNON/i })).toBeVisible({ timeout: 10_000 });
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
    await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 30_000 });
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
      await expect(page.getByText(/D-pad with diagonal steering on the left/i)).toBeVisible();
    } else {
      await expect(page.locator('.control-grid span').filter({ hasText: /SPACE.*FRONT SHOT/i })).toBeVisible();
      await expect(page.locator('.control-grid span').filter({ hasText: /Q \/ E.*BROADSIDE/i })).toBeVisible();
      await expect(page.locator('.control-grid span').filter({ hasText: /R.*POWDER BARREL/i })).toBeVisible();
    }

    await startGame(page);
    await expect(page.getByText('FRONT CANNON')).toBeVisible();
    await expect(page.getByText('BROADSIDE CANNONS')).toBeVisible();

    if (isMobile) {
      await page.getByRole('button', { name: /Front shot/i }).tap();
      const after = await debugState(page);
      expect(after.cooldowns.front).toBeGreaterThan(0);
    }
  });

  test('touch D-pad supports one-thumb diagonal steering and independent multitouch', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Touch steering assertion.');
    await startGame(page);

    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.setPlayerPose(640, 360, 0));
    const beforeLeft = await debugState(page);
    await page.locator('.touch-forward-left').evaluate((button) => {
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 41, pointerType: 'touch', isPrimary: true, buttons: 1 }));
    });
    await page.waitForTimeout(180);
    const diagonalLeft = await debugState(page);
    await page.locator('.touch-forward-left').evaluate((button) => {
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 41, pointerType: 'touch', isPrimary: true }));
    });
    expect(diagonalLeft.player.rotation).toBeLessThan(beforeLeft.player.rotation);
    expect(diagonalLeft.player.x).toBeGreaterThan(beforeLeft.player.x);

    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.setPlayerPose(640, 360, 0));
    const beforeRight = await debugState(page);
    await page.locator('.touch-forward-right').evaluate((button) => {
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 42, pointerType: 'touch', isPrimary: true, buttons: 1 }));
    });
    await page.waitForTimeout(180);
    const diagonalRight = await debugState(page);
    await page.locator('.touch-forward-right').evaluate((button) => {
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 42, pointerType: 'touch', isPrimary: true }));
    });
    expect(diagonalRight.player.rotation).toBeGreaterThan(beforeRight.player.rotation);
    expect(diagonalRight.player.x).toBeGreaterThan(beforeRight.player.x);

    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.setPlayerPose(640, 360, 0));
    await page.locator('.touch-forward').evaluate((button) => {
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 51, pointerType: 'touch', isPrimary: true, buttons: 1 }));
    });
    await page.locator('.touch-turn-left').evaluate((button) => {
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 52, pointerType: 'touch', isPrimary: false, buttons: 1 }));
    });
    await page.waitForTimeout(150);
    const twoFingerCombined = await debugState(page);
    await page.locator('.touch-turn-left').evaluate((button) => {
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 52, pointerType: 'touch', isPrimary: false }));
    });
    await page.locator('.touch-forward').evaluate((button) => {
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 51, pointerType: 'touch', isPrimary: true }));
    });
    expect(twoFingerCombined.player.rotation).toBeLessThan(0);
    expect(twoFingerCombined.player.x).toBeGreaterThan(640);
  });

  test('landscape mobile controls stay inside the viewport', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Touch layout assertion.');
    await startGame(page);
    const viewport = page.viewportSize();
    const navigation = await page.locator('.touch-nav-zone').boundingBox();
    const attackZone = await page.locator('.touch-attack-zone').boundingBox();
    const topbar = await page.locator('.game-topbar').boundingBox();
    expect(viewport && navigation && attackZone && topbar).toBeTruthy();
    if (viewport && navigation && attackZone && topbar) {
      expect(navigation.x).toBeGreaterThanOrEqual(0);
      expect(navigation.y).toBeGreaterThanOrEqual(0);
      expect(navigation.x + navigation.width).toBeLessThanOrEqual(viewport.width + 1);
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

    await page.keyboard.down('Space');
    await page.waitForTimeout(50);
    await page.keyboard.up('Space');
    let state = await debugState(page);
    expect(state.projectiles.filter((shot: any) => shot.owner === 'player').length).toBe(beforeShots + 1);
    expect(state.cooldowns.front).toBeGreaterThan(0);

    await holdKeysTogether(page, ['KeyQ']);
    state = await debugState(page);
    // The global 0.25 s weapon lock prevents an immediate front + broadside burst.
    expect(state.cooldowns.weaponSwitch).toBeGreaterThan(0);

    // Once the lock clears, a held broadside fires normally.
    await page.keyboard.down('KeyQ');
    await page.waitForTimeout(280);
    await page.keyboard.up('KeyQ');
    state = await debugState(page);
    const playerShots = state.projectiles.filter((shot: any) => shot.owner === 'player');
    // The earlier front shot may already have collided or expired; the broadside
    // itself must still contribute its three parallel cannonballs.
    expect(playerShots.length).toBeGreaterThanOrEqual(3);
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

  test('Kraken behaves as a third faction and only player-caused defeat scores', async ({ page }) => {
    await startGame(page);
    const spawned = await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.setPlayerPose(360, 360, 0);
      return api.spawnKraken(820, 360);
    });
    expect(spawned).toBeTruthy();
    let state = await debugState(page);
    expect(state.kraken).toBeTruthy();
    expect(state.kraken.health).toBe(600);

    await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      const kraken = api.getState().kraken;
      api.spawnEnemy('chaser', kraken.x - 54, kraken.y, 100);
      api.advanceTime(0.5);
    });
    state = await debugState(page);
    expect(state.score).toBe(0);
    expect(state.kraken.health).toBeLessThan(600);

    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.damageKraken(999, true));
    state = await debugState(page);
    expect(state.kraken).toBeFalsy();
    expect(state.score).toBe(1);
  });

  test('Kraken proximity is selective and a tentacle hit forces retaliation', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.setPlayerPose(560, 360, 0);
      api.spawnKraken(820, 360);
      api.spawnEnemy('shooter', 610, 360, 100);
      api.advanceTime(0.05);
    });
    let state = await debugState(page);
    let shooter = state.enemies.find((enemy: any) => enemy.kind === 'shooter' && enemy.id.startsWith('debug-enemy'));
    expect(shooter).toBeTruthy();
    expect(shooter.targetingKraken).toBeFalsy();

    await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      const shooter = api.getState().enemies.find((enemy: any) => enemy.kind === 'shooter' && enemy.id.startsWith('debug-enemy'));
      api.krakenAttackAt(shooter.x, shooter.y);
      api.advanceTime(0.65);
    });
    state = await debugState(page);
    shooter = state.enemies.find((enemy: any) => enemy.kind === 'shooter' && enemy.id.startsWith('debug-enemy'));
    expect(shooter.health).toBeLessThan(100);
    expect(shooter.targetingKraken).toBeTruthy();
    expect(shooter.krakenRetaliationTime).toBeGreaterThan(4);
  });

  test('Kraken tentacles stagger naturally and can pressure several targets independently', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.setPlayerPose(700, 360, 0);
      api.spawnKraken(820, 360);
      api.spawnEnemy('shooter', 770, 275, 100);
      api.spawnEnemy('shooter', 900, 420, 100);
      api.advanceTime(0.30);
    });
    let state = await debugState(page);
    expect(state.kraken.activeTentacles).toBe(1);

    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.advanceTime(0.95));
    state = await debugState(page);
    expect(state.player.health).toBeLessThan(100);
    const debugShooters = state.enemies.filter((enemy: any) => enemy.kind === 'shooter' && enemy.id.startsWith('debug-enemy'));
    expect(debugShooters).toHaveLength(2);
    expect(debugShooters.every((enemy: any) => enemy.health < 100)).toBeTruthy();
  });

  test('Kraken routes around an island instead of pinning itself to the coast', async ({ page }) => {
    await startGame(page);
    const spawned = await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.setPlayerPose(430, 214, 0);
      const ok = api.spawnKraken(120, 214);
      api.setKrakenRoamTarget(430, 214);
      api.advanceTime(2.5);
      return ok;
    });
    expect(spawned).toBeTruthy();
    const state = await debugState(page);
    expect(state.kraken).toBeTruthy();
    expect(Math.hypot(state.kraken.x - 120, state.kraken.y - 214)).toBeGreaterThan(90);
    expect(Math.abs(state.kraken.y - 214)).toBeGreaterThan(25);
    expect(state.kraken.stuckTime).toBeLessThan(0.8);
  });

  test('Kraken roaming stays primary after a short opportunistic pursuit', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.setPlayerPose(1120, 620, 0);
      api.spawnKraken(180, 520);
      api.setKrakenRoamTarget(1080, 150);
      api.spawnEnemy('shooter', 235, 520, 500);
      api.advanceTime(0.2);
    });
    let state = await debugState(page);
    // Debug-set roaming carries a commitment window, so nearby spawn churn cannot immediately
    // replace the cross-map destination with an endless nearest-enemy chase.
    expect(state.kraken.pursuitTargetId).toBe('');
    expect(state.kraken.pursuitCooldown).toBeGreaterThan(7);

    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.advanceTime(4));
    state = await debugState(page);
    expect(state.kraken.x).toBeGreaterThan(300);
    expect(state.kraken.roamX).toBeGreaterThan(900);
  });

  test('Shooter hull remains solid during friction contact', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard collision assertion.');
    await startGame(page);
    await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.setPlayerPose(640, 360, 0);
      api.spawnEnemy('shooter', 708, 360, 500);
    });
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(360);
    await page.keyboard.up('KeyW');
    const after = await debugState(page);
    const shooter = after.enemies.find((enemy: any) => enemy.kind === 'shooter');
    expect(shooter).toBeTruthy();
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

  test('Shooter hull friction damages both ships with heavier damage on the Shooter', async ({ page }) => {
    await startGame(page);
    const shooterId = await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.setPlayerPose(640, 360, 0);
      return api.spawnEnemy('shooter', 688, 360, 82);
    });
    const before = await debugState(page);
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.advanceTime(1));
    const after = await debugState(page);
    const shooterBefore = before.enemies.find((enemy: any) => enemy.id === shooterId);
    const shooterAfter = after.enemies.find((enemy: any) => enemy.id === shooterId);
    expect(after.player.health).toBeLessThan(before.player.health);
    expect(before.player.health - after.player.health).toBeLessThan(7);
    expect(shooterBefore).toBeTruthy();
    expect(shooterAfter).toBeTruthy();
    expect(shooterBefore.health - shooterAfter.health).toBeGreaterThan(before.player.health - after.player.health);
  });


  test('Kraken hull friction damages both player and Kraken with boss-safe DPS', async ({ page }) => {
    await startGame(page);
    const spawned = await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.setPlayerPose(640, 360, 0);
      return api.spawnKraken(712, 360);
    });
    expect(spawned).toBeTruthy();
    const before = await debugState(page);
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.advanceTime(0.20));
    const after = await debugState(page);
    expect(after.player.health).toBeLessThan(before.player.health);
    expect(after.kraken).toBeTruthy();
    expect(after.kraken.health).toBeLessThan(before.kraken.health);
    expect(before.kraken.health - after.kraken.health).toBeGreaterThan(before.player.health - after.player.health);
    expect(before.player.health - after.player.health).toBeLessThan(2);
  });

  test('Wind keeps dash immediately ready until the buff expires', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.spawnPickup('wind'));
    await page.waitForTimeout(100);
    const active = await debugState(page);
    expect(active.buffs.wind).toBeGreaterThan(0);
    expect(active.cooldowns.dash).toBe(0);

    await page.keyboard.press('f');
    await page.waitForTimeout(80);
    const afterDash = await debugState(page);
    expect(afterDash.buffs.wind).toBeGreaterThan(0);
    expect(afterDash.cooldowns.dash).toBe(0);
  });

  test('Living Powder auto-fires front + both broadsides and stops when the buff expires', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.spawnPickup('powder'));
    await page.waitForTimeout(120);

    const active = await debugState(page);
    const shots = active.projectiles.filter((shot: any) => shot.owner === 'player');
    expect(active.buffs.powder).toBeGreaterThan(0);
    expect(shots.length).toBeGreaterThanOrEqual(7);
    const speeds = shots.slice(-7).map((shot: any) => Math.hypot(shot.vx, shot.vy));
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeLessThan(0.5);

    await page.evaluate((seconds) => (window as any).__CANNON_RIOT_TEST__.advanceTime(seconds), active.buffs.powder + 2);
    const expired = await debugState(page);
    expect(expired.buffs.powder).toBe(0);
    expect(expired.projectiles.filter((shot: any) => shot.owner === 'player')).toHaveLength(0);

    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.advanceTime(0.8));
    const after = await debugState(page);
    expect(after.projectiles.filter((shot: any) => shot.owner === 'player')).toHaveLength(0);
  });

  test('dash has a short active i-frame, counters Chasers and ends protection immediately', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard dash assertion.');
    await startGame(page);
    const dashTargetId = await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.setPlayerPose(640, 360, 0);
      return api.spawnEnemy('chaser', 710, 360, 30);
    });
    const before = await debugState(page);
    await page.keyboard.down('f');
    await page.waitForTimeout(60);
    await page.keyboard.up('f');
    await page.waitForTimeout(110);
    const during = await debugState(page);
    expect(during.player.health).toBeCloseTo(before.player.health, 3);
    expect(during.player.x).toBeGreaterThan(before.player.x + 40);
    expect(during.enemies.some((enemy: any) => enemy.id === dashTargetId)).toBeFalsy();
    expect(during.score).toBe(1);
    expect(during.cooldowns.dash).toBeGreaterThan(1);

    await page.evaluate(() => (window as any).__CANNON_RIOT_TEST__.advanceTime(0.35));
    const ended = await debugState(page);
    expect(ended.dashActive).toBeFalsy();
    await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      const state = api.getState();
      api.spawnEnemy('chaser', state.player.x + 8, state.player.y, 100);
      api.advanceTime(0.12);
    });
    const vulnerableAgain = await debugState(page);
    expect(vulnerableAgain.player.health).toBeLessThan(before.player.health);
  });

  test('low hull guarantees a nearby medicine or armor emergency drop with cooldown', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      api.damagePlayer(70);
      api.advanceTime(0.12);
    });
    const state = await debugState(page);
    expect(state.player.health).toBeLessThanOrEqual(35);
    expect(state.pickups.some((pickup: any) => pickup.kind === 'medicine' || pickup.kind === 'armor')).toBeTruthy();
    expect(state.emergencyDropCooldown).toBeGreaterThan(11);
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
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByRole('dialog', { name: /PAUSED/i })).toBeVisible();
    const pausedAt = await debugState(page);
    expect(pausedAt.paused).toBeTruthy();
    await page.waitForTimeout(350);
    const paused = await debugState(page);
    expect(paused.paused).toBeTruthy();
    expect(paused.elapsed).toBeCloseTo(pausedAt.elapsed, 2);
    await page.getByRole('dialog', { name: /PAUSED/i }).getByRole('button', { name: 'BACK TO THE RIOT', exact: true }).click();
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
    const player = state.player;
    const playerHealth = player.health;
    const farSplashId = await page.evaluate(({ barrel, player }) => {
      const api = (window as any).__CANNON_RIOT_TEST__;
      const dx = barrel.x - player.x;
      const dy = barrel.y - player.y;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;
      const px = -uy;
      const py = ux;
      api.spawnEnemy('chaser', barrel.x + ux * 24, barrel.y + uy * 24, 100);
      api.spawnEnemy('shooter', barrel.x + ux * 58 + px * 6, barrel.y + uy * 58 + py * 6, 100);
      return api.spawnEnemy('shooter', barrel.x + ux * 145 - px * 12, barrel.y + uy * 145 - py * 12, 100);
    }, { barrel, player });
    await page.waitForTimeout(850);
    state = await debugState(page);
    expect(state.score).toBeGreaterThanOrEqual(1);
    expect(state.player.health).toBeCloseTo(playerHealth, 3);
    const splash = state.enemies.find((enemy: any) => enemy.kind === 'shooter' && enemy.id.startsWith('debug-enemy'));
    expect(splash.health).toBeGreaterThanOrEqual(1);
    expect(splash.health).toBeLessThan(100);
    const farSplash = state.enemies.find((enemy: any) => enemy.id === farSplashId);
    expect(farSplash.health).toBeGreaterThanOrEqual(1);
    expect(farSplash.health).toBeLessThan(100);
  });

  test('timeout result persists across refresh and clean restart resets match state', async ({ page }) => {
    await startGame(page);
    await timeoutMatch(page);
    await expect(page.getByText('TIME EXPIRED')).toBeVisible();
    await page.reload();
    await expect(page.getByText('MATCH OVER')).toBeVisible();
    await page.getByRole('button', { name: 'PLAY AGAIN' }).click();
    await waitForReadyDebugState(page);
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
    await expect(page.getByText(/PAGE 1 \/ 2/i)).toBeVisible({ timeout: 8_000 });
    await page.locator('.pager button').last().click();
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
