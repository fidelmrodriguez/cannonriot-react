import type { MouseEvent, PointerEvent } from 'react';
import type { GameAction } from '../game/input/InputManager';
import { t, type Language } from '../i18n';

interface Props {
  language: Language;
  onAction(action: GameAction, down: boolean): void;
  dashReload: number;
  barrelReload: number;
  barrelCount: number;
}

const bind = (action: GameAction, onAction: Props['onAction']) => ({
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onAction(action, true);
  },
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
    onAction(action, false);
  },
  onPointerCancel: () => onAction(action, false),
  onLostPointerCapture: () => onAction(action, false),
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => event.preventDefault(),
});

export function TouchControls({ language, onAction, dashReload, barrelReload, barrelCount }: Props) {
  const ready = t('game.ready', {}, language);
  const dashLabel = dashReload >= 0.999 ? ready : `${Math.round(dashReload * 100)}%`;
  const barrelLabel = barrelReload >= 0.999 ? ready : `${Math.round(barrelReload * 100)}%`;

  return <div className="touch-controls" aria-label={t('touch.controls', {}, language)}>
    <section className="touch-nav-zone" aria-label={t('touch.navigation', {}, language)}>
      <div className="touch-steering-pad">
        <button className="touch-steer touch-turn-left" aria-label={t('touch.turnLeft', {}, language)} {...bind('left', onAction)}>
          <strong aria-hidden="true">↶</strong><small>{t('touch.left', {}, language)}</small>
        </button>
        <button className="touch-steer touch-forward" aria-label={t('touch.forward', {}, language)} {...bind('forward', onAction)}>
          <strong aria-hidden="true">↑</strong><small>{t('touch.forwardShort', {}, language)}</small>
        </button>
        <button className="touch-steer touch-turn-right" aria-label={t('touch.turnRight', {}, language)} {...bind('right', onAction)}>
          <strong aria-hidden="true">↷</strong><small>{t('touch.right', {}, language)}</small>
        </button>
      </div>
      <button className={`touch-dash ${dashReload >= 0.999 ? 'ready' : ''}`} aria-label={`${t('touch.dash', {}, language)} ${dashLabel}`} {...bind('dash', onAction)}>
        <strong>⚡</strong><span>{t('touch.dash', {}, language)}</span><small>{dashLabel}</small>
      </button>
    </section>

    <section className="touch-attack-zone" aria-label={t('touch.artillery', {}, language)}>
      <button className="touch-side left" aria-label={t('touch.sideLeft', {}, language)} {...bind('broadsideLeft', onAction)}><strong>◀</strong><small>{t('touch.left', {}, language)}</small></button>
      <button className="touch-fire" aria-label={t('touch.frontAria', {}, language)} {...bind('fire', onAction)}><strong>💥</strong><small>{t('touch.front', {}, language)}</small></button>
      <button className="touch-side right" aria-label={t('touch.sideRight', {}, language)} {...bind('broadsideRight', onAction)}><strong>▶</strong><small>{t('touch.right', {}, language)}</small></button>
      <button className={`touch-barrel ${barrelReload >= 0.999 ? 'ready' : ''}`} aria-label={`${t('touch.barrel', {}, language)} ${barrelLabel}. ${barrelCount}/3`} {...bind('barrel', onAction)}>
        <strong>🧨</strong><span>{t('touch.barrel', {}, language)}</span><small>{barrelReload >= 0.999 ? `${barrelCount}/3` : barrelLabel}</small>
      </button>
    </section>
  </div>;
}
