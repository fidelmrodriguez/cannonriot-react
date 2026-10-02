import { useState } from 'react';
import { CONFIG_LIMITS } from '../game/core/config';
import type { GameConfig, NetworkScenario } from '../types/game';
import { getScenario, resetMockState, setScenario } from '../mocks/scenario';
import type { AudioPreferences } from '../audio/preferences';
import { ArcadeButton } from '../components/ArcadeButton';
import { t, type Language } from '../i18n';

const NETWORK_SCENARIOS: NetworkScenario[] = ['normal', 'empty', 'pagination', 'slow', 'timeout', 'variable-latency', 'out-of-order', 'network-error', 'client-error', 'server-error', 'ranking-error', 'history-error', 'timeout-after-save', 'unavailable-on-game-over'];

export function OptionsScreen({
  config,
  language,
  audioPreferences,
  onToggleMusic,
  onToggleSfx,
  onSave,
  onBack,
  onOpenJukebox,
}: {
  config: GameConfig;
  language: Language;
  audioPreferences: AudioPreferences;
  onToggleMusic(): void;
  onToggleSfx(): void;
  onSave(c: GameConfig): void;
  onBack(): void;
  onOpenJukebox(): void;
}) {
  const [sessionTime, setSessionTime] = useState(config.sessionTime);
  const [enemySpawnTime, setEnemySpawnTime] = useState(config.enemySpawnTime);
  const [networkScenario, setNetworkScenario] = useState<NetworkScenario>(() => getScenario());
  const valid = sessionTime >= 60 && sessionTime <= 180 && enemySpawnTime >= 1 && enemySpawnTime <= 8;
  const showDeveloperTools = new URLSearchParams(window.location.search).has('dev') || new URLSearchParams(window.location.search).has('e2e');

  return <main className="panel-screen options-screen"><div className="panel-card options-card">
    <header className="options-header">
      <div className="eyebrow">{t('options.eyebrow', {}, language)}</div>
      <h1>{t('options.title', {}, language)}</h1>
      <p className="lede">{t('options.lede', {}, language)}</p>
    </header>

    <div className="options-columns">
      <section className="options-gameplay-settings" aria-label={t('options.gameSettings', {}, language)}>
        <label>
          <span>{t('options.duration', {}, language)}</span>
          <strong>{sessionTime}s</strong>
          <input aria-label={t('options.duration', {}, language)} type="range" min={CONFIG_LIMITS.sessionTime.min} max={CONFIG_LIMITS.sessionTime.max} step={CONFIG_LIMITS.sessionTime.step} value={sessionTime} onChange={(e) => setSessionTime(Number(e.target.value))}/>
          <small>{t('options.durationHelp', {}, language)}</small>
        </label>

        <label>
          <span>{t('options.spawn', {}, language)}</span>
          <strong>{enemySpawnTime.toFixed(1)}s</strong>
          <input aria-label={t('options.spawn', {}, language)} type="range" min={CONFIG_LIMITS.enemySpawnTime.min} max={CONFIG_LIMITS.enemySpawnTime.max} step={CONFIG_LIMITS.enemySpawnTime.step} value={enemySpawnTime} onChange={(e) => setEnemySpawnTime(Number(e.target.value))}/>
          <small>{t('options.spawnHelp', {}, language)}</small>
        </label>

        <section className="audio-options-card" aria-label={t('options.audio', {}, language)}>
          <div className="audio-options-copy">
            <span>{t('options.audio', {}, language)}</span>
            <strong>{t('options.musicSfx', {}, language)}</strong>
            <small>{t('options.audioHelp', {}, language)}</small>
          </div>
          <div className="audio-options-buttons">
            <button type="button" className={audioPreferences.musicMuted ? 'muted' : ''} onClick={onToggleMusic}>
              <b>{t('options.music', {}, language)}</b>
              <span>{audioPreferences.musicMuted ? t('options.musicMuted', {}, language) : t('options.musicOn', {}, language)}</span>
            </button>
            <button type="button" className={audioPreferences.sfxMuted ? 'muted' : ''} onClick={onToggleSfx}>
              <b>{t('options.effects', {}, language)}</b>
              <span>{audioPreferences.sfxMuted ? t('options.effectsMuted', {}, language) : t('options.effectsOn', {}, language)}</span>
            </button>
          </div>
        </section>
      </section>

      <section className="options-side-settings" aria-label={t('options.extra', {}, language)}>
        <section className="music-option-card">
          <div>
            <span>{t('options.soundtrack', {}, language)}</span>
            <strong>{t('options.playlistTitle', {}, language)}</strong>
            <small>{t('options.playlistHelp', {}, language)}</small>
          </div>
          <ArcadeButton className="secondary" onClick={onOpenJukebox}>{t('options.openPlaylist', {}, language)}</ArcadeButton>
        </section>

        {showDeveloperTools && <section className="technical-options-card" aria-label={t('options.tech', {}, language)}>
          <div>
            <span>{t('options.tech', {}, language)}</span>
            <strong>{t('options.networkScenario', {}, language)}</strong>
            <small>{t('options.networkHelp', {}, language)}</small>
          </div>
          <div className="technical-network-controls">
            <select aria-label={t('options.networkLabel', {}, language)} value={networkScenario} onChange={(event) => {
              const next = event.target.value as NetworkScenario;
              setScenario(next);
              setNetworkScenario(next);
            }}>
              {NETWORK_SCENARIOS.map((scenario) => <option key={scenario} value={scenario}>{t(`scenario.${scenario}`, {}, language)}</option>)}
            </select>
            <button type="button" onClick={() => { resetMockState(); setNetworkScenario('normal'); }}>{t('options.restore', {}, language)}</button>
          </div>
        </section>}
      </section>
    </div>

    {!valid && <p role="alert" className="error-copy">{t('options.invalid', {}, language)}</p>}
    <div className="button-row options-actions">
      <ArcadeButton className="secondary" onClick={onBack}>{t('options.back', {}, language)}</ArcadeButton>
      <ArcadeButton disabled={!valid} onClick={() => onSave({ ...config, sessionTime, enemySpawnTime })}>{t('options.save', {}, language)}</ArcadeButton>
    </div>
  </div></main>;
}
