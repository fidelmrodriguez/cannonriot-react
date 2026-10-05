import { useEffect, useRef, useState } from 'react';
import { GameEngine, type GameSnapshot } from '../game/core/GameEngine';
import type { GameConfig, MatchResult } from '../types/game';
import type { GameAction } from '../game/input/InputManager';
import { TouchControls } from '../components/TouchControls';
import { ArcadeButton } from '../components/ArcadeButton';
import { t, type Language } from '../i18n';
import type { PlayerIdentity } from '../storage/player.storage';

interface Props { config: GameConfig; language: Language; player: PlayerIdentity; onEnd(result: MatchResult): void; onQuit(): void; }
const initialSnapshot: GameSnapshot = { health: 100, maxHealth: 100, score: 0, timeLeft: 0, paused: false, streak: 0, entityCount: 1, enemyCount: 0, frontReload: 1, broadsideReload: 1, dashReload: 1, powderTime: 0, windTime: 0, armorTime: 0, barrelReload: 1, barrelCount: 0 };

function createMatchSeed(): number {
  const params = new URLSearchParams(window.location.search);
  const explicit = Number(params.get('seed'));
  if (Number.isInteger(explicit) && explicit >= 0) return explicit >>> 0;
  if (params.has('e2e')) return 1337;
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] ?? 1337) >>> 0;
}

export function GameScreen({ config, language, player, onEnd, onQuit }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const matchSeedRef = useRef<number>(createMatchSeed());
  const engineRef = useRef<GameEngine | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const [snapshot, setSnapshot] = useState<GameSnapshot>({ ...initialSnapshot, timeLeft: config.sessionTime });
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!hostRef.current) return;
    let cancelled = false;
    const matchConfig = structuredClone(config);
    const engine = new GameEngine(hostRef.current, matchConfig, (matchSeedRef.current + attempt) >>> 0, {
      onSnapshot: (s) => !cancelled && setSnapshot(s),
      onEnd: (result) => !cancelled && onEndRef.current(result),
      onReady: () => !cancelled && setReady(true),
      onLoadProgress: (p) => !cancelled && setProgress(p),
      onLoadError: (m) => !cancelled && setLoadError(m),
    }, player);
    engineRef.current = engine;
    const testWindow = window as Window & { __CANNON_RIOT_TEST__?: {
      getState: () => ReturnType<GameEngine['getDebugState']>;
      damagePlayer: (amount: number) => void;
      spawnPickup: (kind: 'medicine' | 'powder' | 'wind' | 'armor') => void;
      spawnEnemy: (kind: 'chaser' | 'shooter', x: number, y: number, health?: number) => string;
      setEnemyShootCooldown: (id: string, seconds: number) => void;
      setPlayerPose: (x: number, y: number, rotation?: number) => void;
      advanceTime: (seconds: number) => void;
      setTimeRemaining: (seconds: number) => void;
    } };
    if (new URLSearchParams(window.location.search).has('e2e')) {
      testWindow.__CANNON_RIOT_TEST__ = {
        getState: () => engine.getDebugState(),
        damagePlayer: (amount) => engine.debugDamagePlayer(amount),
        spawnPickup: (kind) => engine.debugSpawnPickup(kind),
        spawnEnemy: (kind, x, y, health) => engine.debugSpawnEnemy(kind, x, y, health),
        setEnemyShootCooldown: (id, seconds) => engine.debugSetEnemyShootCooldown(id, seconds),
        setPlayerPose: (x, y, rotation) => engine.debugSetPlayerPose(x, y, rotation),
        advanceTime: (seconds) => engine.debugAdvanceTime(seconds),
        setTimeRemaining: (seconds) => engine.debugSetTimeRemaining(seconds),
      };
    }
    void engine.init().catch(() => undefined);
    return () => {
      cancelled = true;
      if (testWindow.__CANNON_RIOT_TEST__) delete testWindow.__CANNON_RIOT_TEST__;
      engine.destroy();
      engineRef.current = null;
    };
  }, [attempt, config, player.id, player.displayName]);

  useEffect(() => {
    const onPauseKey = (event: KeyboardEvent) => {
      if (!ready || (event.code !== 'Escape' && event.code !== 'KeyP')) return;
      event.preventDefault();
      engineRef.current?.togglePause();
    };
    window.addEventListener('keydown', onPauseKey);
    return () => window.removeEventListener('keydown', onPauseKey);
  }, [ready]);


  const action = (gameAction: GameAction, down: boolean) => engineRef.current?.setAction(gameAction, down);
  const retry = () => {
    setReady(false);
    setLoadError(null);
    setProgress(0);
    setAttempt((v) => v + 1);
  };
  const hpPct = Math.round((snapshot.health / snapshot.maxHealth) * 100);

  return <main className={`game-shell ${hpPct <= 30 ? 'critical-hull' : ''}`}>
    <section className="game-topbar" data-live-label={t('game.live', {}, language)} aria-label={t('game.points', {}, language)}>
      <div className="hud-block hp-block"><span>{t('game.hull', {}, language)}</span><div className="hp-track"><i style={{ width: `${hpPct}%` }} /></div><strong>{Math.ceil(snapshot.health)}</strong></div>
      <div className="hud-time"><small>{t('game.time', {}, language)}</small><strong>{Math.ceil(snapshot.timeLeft)}</strong></div>
      <div className="hud-score"><small>{t('game.points', {}, language)}</small><strong>{snapshot.score}</strong><em className={snapshot.streak >= 3 ? 'hud-streak is-visible' : 'hud-streak'}>{snapshot.streak >= 3 ? t('game.chaos', { n: snapshot.streak }, language) : '\u00A0'}</em></div>
      <button className="pause-button" onClick={() => engineRef.current?.togglePause()} aria-label={snapshot.paused ? t('game.resume', {}, language) : t('game.pause', {}, language)}>{snapshot.paused ? '▶' : 'Ⅱ'}</button>
    </section>

    <section className="weapon-status-strip" aria-label={t('game.reloadStatus', {}, language)}>
      <div className={`reload-card frontal ${snapshot.frontReload >= 0.999 ? 'ready' : ''}`}>
        <span>{t('game.front', {}, language)}</span><div className="reload-track"><i style={{ width: `${Math.round(snapshot.frontReload * 100)}%` }} /></div><b>{snapshot.frontReload >= 0.999 ? t('game.ready', {}, language) : t('game.reloading', {}, language)}</b>
      </div>
      <div className={`reload-card lateral ${snapshot.broadsideReload >= 0.999 ? 'ready' : ''}`}>
        <span>{t('game.sides', {}, language)}</span><div className="reload-track"><i style={{ width: `${Math.round(snapshot.broadsideReload * 100)}%` }} /></div><b>{snapshot.broadsideReload >= 0.999 ? t('game.ready', {}, language) : t('game.reloading', {}, language)}</b>
      </div>
      <div className={`dash-chip ${snapshot.dashReload >= 0.999 ? 'ready' : ''}`}><span>F</span><b>DASH {snapshot.dashReload >= 0.999 ? t('game.ready', {}, language) : `${Math.round(snapshot.dashReload * 100)}%`}</b></div>
      <div className={`barrel-chip ${snapshot.barrelReload >= 0.999 ? 'ready' : ''}`}><span>R</span><b>{t('game.barrel', {}, language)} {snapshot.barrelReload >= 0.999 ? t('game.ready', {}, language) : `${Math.round(snapshot.barrelReload * 100)}%`}</b><small>{snapshot.barrelCount}/3</small></div>
      <div className="buff-dock" aria-live="polite">
        {snapshot.powderTime > 0 && <span className="buff powder">{t('game.powder', {}, language)} {Math.ceil(snapshot.powderTime)}s</span>}
        {snapshot.windTime > 0 && <span className="buff wind">{t('game.wind', {}, language)} {Math.ceil(snapshot.windTime)}s</span>}
        {snapshot.armorTime > 0 && <span className="buff armor">{t('game.armor', {}, language)} {Math.ceil(snapshot.armorTime)}s</span>}
      </div>
    </section>

    <div className="arena-wrap">
      <div className="hostile-chip" aria-hidden="true"><span>{t('game.enemies', {}, language)}</span><b>{snapshot.enemyCount}</b></div>
      {hpPct <= 30 && <div className="danger-banner" aria-hidden="true">{t('game.critical', {}, language)}</div>}
      {snapshot.streak >= 3 && <div className="riot-banner" aria-hidden="true"><small>{t('game.chain', {}, language)}</small><strong>{t('game.chaos', { n: snapshot.streak }, language)}</strong></div>}
      {hpPct <= 30 && <div className="critical-vignette" aria-hidden="true" />}
      <div className="arena-stage" ref={hostRef} data-testid="game-canvas" />
      {!ready && <div className="loading-overlay" role="status">
        {loadError ? <><b>{t('game.loadFail', {}, language)}</b><p>{loadError}</p><ArcadeButton onClick={retry}>{t('game.retry', {}, language)}</ArcadeButton></> : <><b>{t('game.loadingCannons', {}, language)}</b><div className="load-track"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div><span>{Math.round(progress * 100)}%</span></>}
      </div>}
      {snapshot.paused && ready && <div className="pause-overlay" role="dialog" aria-modal="true" aria-label={t('game.paused', {}, language)}>
        <div className="comic-card"><span className="burst">{t('game.paused', {}, language)}</span><h2>{t('game.holdChaos', {}, language)}</h2><p>{t('game.pauseDesc', {}, language)}</p><ArcadeButton autoFocus onClick={() => engineRef.current?.togglePause(false)}>{t('game.resume', {}, language)}</ArcadeButton><button className="text-button" onClick={onQuit}>{t('game.quit', {}, language)}</button></div>
      </div>}
    </div>
    <div className="desktop-controls" aria-label={t('game.keyboard', {}, language)}><span><kbd>W / ↑</kbd> {t('game.advance', {}, language)}</span><span><kbd>A / ←</kbd> {t('game.turnLeft', {}, language)}</span><span><kbd>D / →</kbd> {t('game.turnRight', {}, language)}</span><span><kbd>SPACE</kbd> {t('game.frontShot', {}, language)}</span><span><kbd>Q</kbd> {t('game.leftSide', {}, language)}</span><span><kbd>E</kbd> {t('game.rightSide', {}, language)}</span><span><kbd>F</kbd> dash</span><span><kbd>R</kbd> {t('game.powderBarrel', {}, language)}</span><span><kbd>P / ESC</kbd> {t('game.pause', {}, language)}</span></div>
    <TouchControls language={language} onAction={action} dashReload={snapshot.dashReload} barrelReload={snapshot.barrelReload} barrelCount={snapshot.barrelCount} />
    <div className="sr-only" aria-live="polite">{t('game.sr', { score: snapshot.score, time: Math.ceil(snapshot.timeLeft), health: Math.ceil(snapshot.health) }, language)}</div>
  </main>;
}
