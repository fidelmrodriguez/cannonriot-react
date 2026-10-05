export type GameAction = 'forward' | 'left' | 'right' | 'fire' | 'broadsideLeft' | 'broadsideRight' | 'dash' | 'barrel';

const KEY_MAP: Record<string, GameAction> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'fire',
  KeyQ: 'broadsideLeft',
  KeyE: 'broadsideRight',
  KeyF: 'dash',
  KeyR: 'barrel',
};

export class InputManager {
  private pressed = new Set<GameAction>();
  private enabled = true;

  private keyDown = (event: KeyboardEvent) => {
    if (!this.enabled) return;
    const action = KEY_MAP[event.code];
    if (!action) return;
    event.preventDefault();
    this.pressed.add(action);
  };

  private keyUp = (event: KeyboardEvent) => {
    const action = KEY_MAP[event.code];
    if (action) this.pressed.delete(action);
  };

  attach(): void {
    window.addEventListener('keydown', this.keyDown, { passive: false });
    window.addEventListener('keyup', this.keyUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    this.pressed.clear();
  }

  isDown(action: GameAction): boolean { return this.pressed.has(action); }
  set(action: GameAction, down: boolean): void {
    if (!this.enabled && down) return;
    down ? this.pressed.add(action) : this.pressed.delete(action);
  }
  clear(): void { this.pressed.clear(); }
  setEnabled(enabled: boolean): void { this.enabled = enabled; if (!enabled) this.clear(); }
}
