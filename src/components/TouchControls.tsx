import { useRef, type MouseEvent, type PointerEvent } from 'react';
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
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => event.preventDefault(),
});

export function TouchControls({ language, onAction, dashReload, barrelReload, barrelCount }: Props) {
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const moveStateRef = useRef({ left: false, right: false, forward: false });

  const applyMoveState = (next: { left: boolean; right: boolean; forward: boolean }) => {
    const current = moveStateRef.current;
    if (current.left !== next.left) onAction('left', next.left);
    if (current.right !== next.right) onAction('right', next.right);
    if (current.forward !== next.forward) onAction('forward', next.forward);
    moveStateRef.current = next;
  };

  const updateStick = (event: PointerEvent<HTMLDivElement>) => {
    const stick = stickRef.current;
    const knob = knobRef.current;
    if (!stick || !knob) return;
    const rect = stick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = Math.max(24, rect.width * 0.34);
    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > maxRadius) {
      const scale = maxRadius / distance;
      dx *= scale; dy *= scale;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / maxRadius;
    const ny = dy / maxRadius;
    applyMoveState({ left: nx < -0.2, right: nx > 0.2, forward: ny < -0.16 });
  };

  const resetStick = (event?: PointerEvent<HTMLDivElement>) => {
    const stick = stickRef.current;
    const knob = knobRef.current;
    if (event && stick?.hasPointerCapture?.(event.pointerId)) stick.releasePointerCapture?.(event.pointerId);
    pointerIdRef.current = null;
    if (knob) knob.style.transform = 'translate(0px, 0px)';
    applyMoveState({ left: false, right: false, forward: false });
  };

  const ready = t('game.ready', {}, language);
  const dashLabel = dashReload >= 0.999 ? ready : `${Math.round(dashReload * 100)}%`;
  const barrelLabel = barrelReload >= 0.999 ? ready : `${Math.round(barrelReload * 100)}%`;

  return <div className="touch-controls" aria-label={t('touch.controls', {}, language)}>
    <section className="touch-nav-zone" aria-label={t('touch.navigation', {}, language)}>
      <div ref={stickRef} className="touch-joystick" role="application" aria-label={t('touch.joystick', {}, language)}
        onPointerDown={(event) => { event.preventDefault(); pointerIdRef.current = event.pointerId; event.currentTarget.setPointerCapture?.(event.pointerId); updateStick(event); }}
        onPointerMove={(event) => { if (pointerIdRef.current !== event.pointerId) return; event.preventDefault(); updateStick(event); }}
        onPointerUp={resetStick} onPointerCancel={resetStick} onContextMenu={(event) => event.preventDefault()}>
        <span className="touch-joystick-ring" aria-hidden="true" /><span className="touch-joystick-arrow" aria-hidden="true">▲</span>
        <div ref={knobRef} className="touch-joystick-knob"><i /></div><small>{t('touch.helm', {}, language)}</small>
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
