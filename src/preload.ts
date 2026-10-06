import { Assets } from 'pixi.js';
import { GAME_ASSETS } from './game/rendering/assets';
import { t } from './i18n';

const audioObjectUrls = new Map<string, string>();
let mockWorkerStarted = false;
let deferredWarmupStarted = false;
const PRELOAD_LOG = '[Cannon Riot preload]';

type NavigatorPerformanceHints = Navigator & {
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
};

function absoluteAssetUrl(url: string): string {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

function performanceHints() {
  const nav = navigator as NavigatorPerformanceHints;
  const cores = Math.max(1, nav.hardwareConcurrency || 4);
  const memory = nav.deviceMemory ?? 8;
  const effectiveType = nav.connection?.effectiveType ?? '';
  const saveData = nav.connection?.saveData === true;
  const constrainedNetwork = saveData || effectiveType === 'slow-2g' || effectiveType === '2g';
  const lowEnd = cores <= 4 || memory <= 4;
  return { cores, memory, effectiveType, saveData, constrainedNetwork, lowEnd };
}

async function logFailedRequestDetails(kind: string, url: string, originalError: unknown): Promise<void> {
  const absoluteUrl = absoluteAssetUrl(url);
  console.error(`${PRELOAD_LOG} ${kind} failed permanently`, {
    url,
    absoluteUrl,
    online: navigator.onLine,
    page: window.location.href,
    error: originalError,
  });

  // Diagnostic only: same URL, no query string/cache-busting.
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    console.error(`${PRELOAD_LOG} ${kind} HTTP diagnostic`, {
      url,
      absoluteUrl,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      cacheControl: response.headers.get('cache-control'),
      etag: response.headers.get('etag'),
    });
  } catch (diagnosticError) {
    console.error(`${PRELOAD_LOG} ${kind} HTTP diagnostic could not run`, {
      url,
      absoluteUrl,
      error: diagnosticError,
    });
  }
}

/**
 * Only assets required to enter the menu and start gameplay are allowed to block
 * the boot screen. Portraits, result scenes and the battle jukebox are loaded
 * lazily/background so older devices do not decode ~50 MB of cosmetics at once.
 */
export const CORE_GAME_TEXTURE_URLS = [
  GAME_ASSETS.player,
  GAME_ASSETS.chaser,
  GAME_ASSETS.shooter,
  GAME_ASSETS.kraken,
  GAME_ASSETS.cannonBall,
  GAME_ASSETS.explosion,
  GAME_ASSETS.fire,
] as const;

const BOOT_SCREEN_IMAGE_URLS = [
  '/assets/ui/menu-wallpaper-hero.webp',
] as const;

const DEFERRED_SCREEN_IMAGE_URLS = [
  '/assets/ui/result-defeat-wallpaper.webp',
  '/assets/ui/result-timeout-wallpaper.webp',
] as const;

export const REACTION_TEXTURE_URLS = [
  ...GAME_ASSETS.damagePortraits,
  ...GAME_ASSETS.victoryPortraits,
  ...GAME_ASSETS.frictionPortraits,
  ...Object.values(GAME_ASSETS.mechanicPortraits),
  ...Object.values(GAME_ASSETS.krakenPortraits),
  ...GAME_ASSETS.idlePortraits,
] as const;

const SFX_URLS = [
  GAME_ASSETS.shotSound,
  GAME_ASSETS.broadsideSound,
  GAME_ASSETS.explosionSound,
  ...GAME_ASSETS.hitSounds,
  GAME_ASSETS.collisionSound,
  GAME_ASSETS.idleChirpSound,
  GAME_ASSETS.pickupSound,
  GAME_ASSETS.dashSound,
  GAME_ASSETS.krakenReactSound,
] as const;

const BOOT_AUDIO_URLS: readonly string[] = [];

export const PRELOAD_ASSET_COUNT = CORE_GAME_TEXTURE_URLS.length
  + BOOT_SCREEN_IMAGE_URLS.length
  + SFX_URLS.length
  + BOOT_AUDIO_URLS.length;

export function getPreloadedAudioUrl(url: string): string {
  return audioObjectUrls.get(url) ?? url;
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

async function waitForIdle(): Promise<void> {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };
  await new Promise<void>((resolve) => {
    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(() => resolve(), { timeout: 700 });
      return;
    }
    window.setTimeout(resolve, 28);
  });
}

export async function preloadPixiTexture(url: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const attemptNumber = attempt + 1;
    console.info(`${PRELOAD_LOG} texture start`, {
      url,
      absoluteUrl: absoluteAssetUrl(url),
      attempt: attemptNumber,
      maxAttempts: 3,
    });
    try {
      await Assets.load(url);
      console.info(`${PRELOAD_LOG} texture loaded`, { url, attempt: attemptNumber });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        console.warn(`${PRELOAD_LOG} texture attempt failed; retrying`, {
          url,
          absoluteUrl: absoluteAssetUrl(url),
          attempt: attemptNumber,
          error,
        });
        await wait(180 * attemptNumber);
      }
    }
  }
  await logFailedRequestDetails('texture', url, lastError);
  throw lastError;
}

async function preloadDomImage(url: string): Promise<void> {
  console.info(`${PRELOAD_LOG} screen image start`, { url, absoluteUrl: absoluteAssetUrl(url) });
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(t('boot.imageError', { url })));
      image.src = url;
    });
    console.info(`${PRELOAD_LOG} screen image loaded`, { url });
  } catch (error) {
    await logFailedRequestDetails('screen image', url, error);
    throw error;
  }
}

async function warmHttpCache(url: string): Promise<void> {
  try {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    // Consume the response so the browser can commit it to HTTP cache, but do not
    // decode it into a Pixi texture yet. This keeps GPU/main-thread pressure low.
    await response.arrayBuffer();
  } catch (error) {
    console.warn(`${PRELOAD_LOG} optional cache warm failed`, { url, error });
  }
}

async function preloadAudio(url: string): Promise<void> {
  if (audioObjectUrls.has(url)) {
    console.info(`${PRELOAD_LOG} audio already cached`, { url });
    return;
  }
  console.info(`${PRELOAD_LOG} audio start`, { url, absoluteUrl: absoluteAssetUrl(url) });
  try {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`${t('boot.audioError', { url })} (HTTP ${response.status} ${response.statusText})`);
    }
    const blob = await response.blob();
    audioObjectUrls.set(url, URL.createObjectURL(blob));
    console.info(`${PRELOAD_LOG} audio loaded`, {
      url,
      status: response.status,
      type: blob.type,
      bytes: blob.size,
    });
  } catch (error) {
    await logFailedRequestDetails('audio', url, error);
    throw error;
  }
}

async function runWithConcurrency(tasks: (() => Promise<void>)[], concurrency: number, onDone: () => void): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;
      await tasks[index]!();
      onDone();
    }
  });
  await Promise.all(workers);
}

export async function preloadAllAssets(onProgress: (progress: number, stage: string) => void): Promise<void> {
  const hints = performanceHints();
  const textureConcurrency = hints.lowEnd ? 2 : 3;
  const audioConcurrency = hints.lowEnd ? 2 : 4;

  console.info(`${PRELOAD_LOG} boot started`, {
    page: window.location.href,
    origin: window.location.origin,
    baseURI: document.baseURI,
    online: navigator.onLine,
    textureCount: CORE_GAME_TEXTURE_URLS.length,
    screenImageCount: BOOT_SCREEN_IMAGE_URLS.length,
    sfxCount: SFX_URLS.length,
    musicCount: BOOT_AUDIO_URLS.length,
    total: PRELOAD_ASSET_COUNT,
    performanceHints: hints,
  });
  onProgress(0, 'boot.network');
  if (!mockWorkerStarted) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass', serviceWorker: { url: '/mockServiceWorker.js' } });
    mockWorkerStarted = true;
  }

  let loaded = 0;
  const total = PRELOAD_ASSET_COUNT;
  const step = (label: string) => {
    loaded += 1;
    onProgress(Math.min(1, loaded / total), label);
  };

  onProgress(0, 'boot.hold');

  const textureTasks = CORE_GAME_TEXTURE_URLS.map((url) => async () => {
    await preloadPixiTexture(url);
    step('boot.textures');
  });
  await runWithConcurrency(textureTasks, textureConcurrency, () => undefined);

  const screenTasks = BOOT_SCREEN_IMAGE_URLS.map((url) => async () => {
    await preloadDomImage(url);
    step('boot.scenes');
  });
  await runWithConcurrency(screenTasks, 1, () => undefined);

  const soundTasks = SFX_URLS.map((url) => async () => {
    await preloadAudio(url);
    step('boot.sfx');
  });
  await runWithConcurrency(soundTasks, audioConcurrency, () => undefined);

  const menuMusicTasks = BOOT_AUDIO_URLS.map((url) => async () => {
    await preloadAudio(url);
    step('boot.music');
  });
  await runWithConcurrency(menuMusicTasks, 1, () => undefined);

  onProgress(1, 'boot.done');
  console.info(`${PRELOAD_LOG} boot completed`, { loaded, total });
}

/**
 * Optional warmup runs after the boot screen has finished. It never blocks the
 * menu or gameplay, uses a single worker and yields between decodes. On devices
 * with <=4 GB RAM, <=4 logical cores, Save-Data or 2G, cosmetics stay fully
 * on-demand to avoid memory/CPU spikes.
 */
export async function preloadDeferredAssets(): Promise<void> {
  if (deferredWarmupStarted) return;
  deferredWarmupStarted = true;
  const hints = performanceHints();
  if (hints.constrainedNetwork) {
    console.info(`${PRELOAD_LOG} deferred warmup skipped on constrained network`, hints);
    return;
  }

  console.info(`${PRELOAD_LOG} deferred warmup started`, {
    reactionTextures: REACTION_TEXTURE_URLS.length,
    resultScenes: DEFERRED_SCREEN_IMAGE_URLS.length,
    lowEnd: hints.lowEnd,
  });

  // Kraken event portraits are story-critical and only ~1.2 MB combined after
  // optimization. Warm their compressed files even on low-end hardware, but do
  // not decode them into Pixi/GPU memory until the event actually happens.
  for (const url of Object.values(GAME_ASSETS.krakenPortraits)) {
    await waitForIdle();
    await warmHttpCache(url);
  }

  if (hints.lowEnd) {
    console.info(`${PRELOAD_LOG} low-end deferred warmup limited to Kraken event portraits`);
    return;
  }

  // Result scenes are cheaper to cache as DOM images and are likely to be needed
  // before a second match. They do not occupy Pixi texture memory.
  for (const url of DEFERRED_SCREEN_IMAGE_URLS) {
    await waitForIdle();
    try { await preloadDomImage(url); } catch { /* optional asset; retry on actual use */ }
  }

  // Warm only the browser HTTP cache for the remaining portraits; Pixi/GPU decode
  // stays lazy. This avoids keeping dozens of reaction textures resident.
  const krakenPortraitSet = new Set(Object.values(GAME_ASSETS.krakenPortraits));
  for (const url of REACTION_TEXTURE_URLS) {
    if (krakenPortraitSet.has(url)) continue;
    await waitForIdle();
    await warmHttpCache(url);
  }

  console.info(`${PRELOAD_LOG} deferred warmup completed`);
}
