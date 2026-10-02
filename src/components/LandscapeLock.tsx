import { useEffect } from 'react';

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'landscape-primary' | 'landscape-secondary') => Promise<void>;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};

function isTouchLikeDevice(): boolean {
  return navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches;
}

/**
 * Best-effort native landscape lock for browsers that support it.
 * The visual fallback is CSS-driven: portrait touch viewports rotate the entire
 * app into a virtual landscape canvas instead of blocking the player.
 */
export function LandscapeLock() {
  useEffect(() => {
    if (!isTouchLikeDevice() || new URLSearchParams(window.location.search).has('e2e')) return;

    let fullscreenRequested = false;
    let lockInFlight = false;

    const requestLandscape = async () => {
      if (lockInFlight) return;
      lockInFlight = true;
      try {
        const root = document.documentElement as FullscreenElement;
        if (!document.fullscreenElement && !fullscreenRequested) {
          try {
            if (root.requestFullscreen) {
              await root.requestFullscreen({ navigationUI: 'hide' });
              fullscreenRequested = true;
            } else if (root.webkitRequestFullscreen) {
              root.webkitRequestFullscreen();
              fullscreenRequested = true;
            }
          } catch {
            // Fullscreen is optional. CSS still keeps the game landscape.
          }
        }

        try {
          await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape');
        } catch {
          // iOS and orientation-locked Android browsers may reject this.
          // The app remains horizontal through the CSS virtual-landscape fallback.
        }
      } finally {
        lockInFlight = false;
      }
    };

    const onGesture = () => { void requestLandscape(); };
    window.addEventListener('pointerup', onGesture, { passive: true });
    window.addEventListener('touchend', onGesture, { passive: true });

    return () => {
      window.removeEventListener('pointerup', onGesture);
      window.removeEventListener('touchend', onGesture);
    };
  }, []);

  return null;
}
