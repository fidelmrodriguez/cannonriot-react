import { useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { GameAction } from '../game/input/InputManager';
import { t, type Language } from '../i18n';

interface Props {
  language: Language;
  onAction(action: GameAction, down: boolean): void;
  dashReload: number;
  barrelReload: number;
  barrelCount: number;
}

export function TouchControls({ language, onAction, dashReload, barrelReload, barrelCount }: Props) {
  const ready = t('game.ready', {}, language);
  const dashLabel = dashReload >= 0.999 ? ready : `${Math.round(dashReload * 100)}%`;
  const barrelLabel = barrelReload >= 0.999 ? ready : `${Math.round(barrelReload * 100)}%`;
  const onActionRef = useRef(onAction);
  const pointerActionsRef = useRef(new Map<number, GameAction>());
  const actionPointersRef = useRef(new Map<GameAction, Set<number>>());
  onActionRef.current = onAction;

  const releasePointer = (pointerId: number) => {
    const action = pointerActionsRef.current.get(pointerId);
    if (!action) return;

    pointerActionsRef.current.delete(pointerId);
    const pointers = actionPointersRef.current.get(action);
    if (!pointers) return;
    pointers.delete(pointerId);
    if (pointers.size > 0) return;

    actionPointersRef.current.delete(action);
    onActionRef.current(action, false);
  };

  const pressPointer = (action: GameAction, pointerId: number) => {
    const previousAction = pointerActionsRef.current.get(pointerId);
    if (previousAction === action) return;
    if (previousAction) releasePointer(pointerId);

    let pointers = actionPointersRef.current.get(action);
    if (!pointers) {
      pointers = new Set<number>();
      actionPointersRef.current.set(action, pointers);
    }

    const wasUp = pointers.size === 0;
    pointers.add(pointerId);
    pointerActionsRef.current.set(pointerId, action);
    if (wasUp) onActionRef.current(action, true);
  };

  const releaseAllPointers = () => {
    const activeActions = [...actionPointersRef.current.keys()];
    pointerActionsRef.current.clear();
    actionPointersRef.current.clear();
    for (const action of activeActions) onActionRef.current(action, false);
  };

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) releaseAllPointers();
    };
    window.addEventListener('blur', releaseAllPointers);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', releaseAllPointers);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      releaseAllPointers();
    };
  }, []);

  const bind = (action: GameAction) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      pressPointer(action, event.pointerId);
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic E2E events and a few mobile browsers can reject pointer capture.
        // Per-pointer state still keeps simultaneous directional presses independent.
      }
    },
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      releasePointer(event.pointerId);
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch {
        // The pointer may already have been released/cancelled by the browser.
      }
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => releasePointer(event.pointerId),
    onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => releasePointer(event.pointerId),
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => event.preventDefault(),
  });

  return <div className="touch-controls" aria-label={t('touch.controls', {}, language)}>
    <section className="touch-nav-zone" aria-label={t('touch.navigation', {}, language)}>
      <div className="touch-steering-pad">
        <button className="touch-steer touch-turn-left" aria-label={t('touch.turnLeft', {}, language)} {...bind('left')}>
          <strong aria-hidden="true">↶</strong><small>{t('touch.left', {}, language)}</small>
        </button>
        <button className="touch-steer touch-forward" aria-label={t('touch.forward', {}, language)} {...bind('forward')}>
          <strong aria-hidden="true">↑</strong><small>{t('touch.forwardShort', {}, language)}</small>
        </button>
        <button className="touch-steer touch-turn-right" aria-label={t('touch.turnRight', {}, language)} {...bind('right')}>
          <strong aria-hidden="true">↷</strong><small>{t('touch.right', {}, language)}</small>
        </button>
      </div>
      <button className={`touch-dash ${dashReload >= 0.999 ? 'ready' : ''}`} aria-label={`${t('touch.dash', {}, language)} ${dashLabel}`} {...bind('dash')}>
        <strong>⚡</strong><span>{t('touch.dash', {}, language)}</span><small>{dashLabel}</small>
      </button>
    </section>

    <section className="touch-attack-zone" aria-label={t('touch.artillery', {}, language)}>
      <button className="touch-side left" aria-label={t('touch.sideLeft', {}, language)} {...bind('broadsideLeft')}><strong>◀</strong><small>{t('touch.left', {}, language)}</small></button>
      <button className="touch-fire" aria-label={t('touch.frontAria', {}, language)} {...bind('fire')}><strong>💥</strong><small>{t('touch.front', {}, language)}</small></button>
      <button className="touch-side right" aria-label={t('touch.sideRight', {}, language)} {...bind('broadsideRight')}><strong>▶</strong><small>{t('touch.right', {}, language)}</small></button>
      <button className={`touch-barrel ${barrelReload >= 0.999 ? 'ready' : ''}`} aria-label={`${t('touch.barrel', {}, language)} ${barrelLabel}. ${barrelCount}/3`} {...bind('barrel')}>
        <strong>🧨</strong><span>{t('touch.barrel', {}, language)}</span><small>{barrelReload >= 0.999 ? `${barrelCount}/3` : barrelLabel}</small>
      </button>
    </section>
  </div>;
}
