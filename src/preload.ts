import { Assets } from 'pixi.js';
import { ALL_MUSIC_TRACKS } from './audio/music';
import { GAME_ASSETS } from './game/rendering/assets';
import { t } from './i18n';

const audioObjectUrls = new Map<string, string>();
let mockWorkerStarted = false;
const PRELOAD_LOG = '[Cannon Riot preload]';

function absoluteAssetUrl(url: string): string {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
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

  // Diagnostic only: same URL, no query string/cache-busting. A HEAD request helps
  // distinguish an HTTP/deploy problem from a Pixi/browser decoding failure.
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

const GAME_TEXTURE_URLS = [
  GAME_ASSETS.player,
  GAME_ASSETS.chaser,
  GAME_ASSETS.shooter,
  GAME_ASSETS.kraken,
  GAME_ASSETS.cannonBall,
  GAME_ASSETS.explosion,
  GAME_ASSETS.fire,
  ...GAME_ASSETS.damagePortraits,
  ...GAME_ASSETS.victoryPortraits,
  ...GAME_ASSETS.frictionPortraits,
  ...GAME_ASSETS.idlePortraits,
  ...Object.values(GAME_ASSETS.mechanicPortraits),
] as const;

const SCREEN_IMAGE_URLS = [
  '/assets/ui/menu-wallpaper-hero.png',
  '/assets/ui/result-defeat-wallpaper.png',
  '/assets/ui/result-timeout-wallpaper.png',
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
] as const;

const MUSIC_URLS = ALL_MUSIC_TRACKS.map((track) => track.src);

export const PRELOAD_ASSET_COUNT = GAME_TEXTURE_URLS.length + SCREEN_IMAGE_URLS.length + SFX_URLS.length + MUSIC_URLS.length;

export function getPreloadedAudioUrl(url: string): string {
  return audioObjectUrls.get(url) ?? url;
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

async function preloadPixiTexture(url: string): Promise<void> {
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
  console.info(`${PRELOAD_LOG} boot started`, {
    page: window.location.href,
    origin: window.location.origin,
    baseURI: document.baseURI,
    online: navigator.onLine,
    textureCount: GAME_TEXTURE_URLS.length,
    screenImageCount: SCREEN_IMAGE_URLS.length,
    sfxCount: SFX_URLS.length,
    musicCount: MUSIC_URLS.length,
    total: PRELOAD_ASSET_COUNT,
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

  const textureTasks = GAME_TEXTURE_URLS.map((url) => async () => {
    await preloadPixiTexture(url);
    step('boot.textures');
  });
  await runWithConcurrency(textureTasks, 3, () => undefined);

  const screenTasks = SCREEN_IMAGE_URLS.map((url) => async () => {
    await preloadDomImage(url);
    step('boot.scenes');
  });
  await runWithConcurrency(screenTasks, 3, () => undefined);

  const soundTasks = SFX_URLS.map((url) => async () => {
    await preloadAudio(url);
    step('boot.sfx');
  });
  await runWithConcurrency(soundTasks, 4, () => undefined);

  const musicTasks = MUSIC_URLS.map((url) => async () => {
    await preloadAudio(url);
    step('boot.music');
  });
  await runWithConcurrency(musicTasks, 3, () => undefined);

  onProgress(1, 'boot.done');
  console.info(`${PRELOAD_LOG} boot completed`, { loaded, total });
}
