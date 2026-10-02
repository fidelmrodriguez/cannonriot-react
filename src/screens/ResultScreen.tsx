import type { MatchResult } from '../types/game';
import { ArcadeButton } from '../components/ArcadeButton';
import { t, type Language } from '../i18n';

interface Props {
  language: Language;
  result: MatchResult;
  saveState: 'saving' | 'saved' | 'failed';
  onRetry(): void;
  onAgain(): void;
  onMenu(): void;
}

export function ResultScreen({ language, result, saveState, onRetry, onAgain, onMenu }: Props) {
  const timeout = result.endReason === 'timeout';
  const title = t(timeout ? 'result.timeoutTitle' : 'result.destroyedTitle', {}, language);
  const subtitle = t(timeout ? 'result.timeoutSubtitle' : 'result.destroyedSubtitle', {}, language);
  const wallpaper = timeout
    ? '/assets/ui/result-timeout-wallpaper.png'
    : '/assets/ui/result-defeat-wallpaper.png';

  return (
    <main className="result-scene-screen">
      <div className="result-wallpaper" style={{ backgroundImage: `url(${wallpaper})` }} aria-hidden="true" />
      <div className="result-wallpaper-shade" aria-hidden="true" />
      <div className="menu-noise" aria-hidden="true" />

      <div className="result-scene-layout">
        <section className="result-side-card result-summary-card">
          <p className="eyebrow">{t('result.ended', {}, language)}</p>
          <h1>{title}</h1>
          <p className="result-blurb">{subtitle}</p>

          <div className="result-score scenic-score">
            <span>{t('result.score', {}, language)}</span>
            <strong>{result.score}</strong>
            <small>{t('result.scoreHelp', {}, language)}</small>
          </div>

          <div className="result-grid scenic-result-grid">
            <div><span>{t('result.timePlayed', {}, language)}</span><b>{result.duration}s</b></div>
            <div><span>{t('result.end', {}, language)}</span><b>{t(timeout ? 'result.timeout' : 'result.destroyed', {}, language)}</b></div>
            <div><span>{t('result.rules', {}, language)}</span><b>{result.config.sessionTime}s / {t('result.spawn', {}, language)} {result.config.enemySpawnTime}s</b></div>
          </div>
        </section>

        <div className="result-scene-center" aria-hidden="true" />

        <section className="result-side-card result-actions-card">
          <p className="eyebrow">{t('result.now', {}, language)}</p>
          <h2>{t(timeout ? 'result.moreChaos' : 'result.again', {}, language)}</h2>
          <p className="result-blurb">{t(timeout ? 'result.timeoutBlurb' : 'result.destroyedBlurb', {}, language)}</p>

          <div className={`save-status ${saveState}`}>
            {saveState === 'saving' && t('result.saving', {}, language)}
            {saveState === 'saved' && t('result.saved', {}, language)}
            {saveState === 'failed' && <>{t('result.pending', {}, language)} <button onClick={onRetry}>{t('result.retry', {}, language)}</button></>}
          </div>

          <div className="button-row result-action-row">
            <ArcadeButton className="secondary" onClick={onMenu}>{t('result.menu', {}, language)}</ArcadeButton>
            <ArcadeButton onClick={onAgain}>{t('result.playAgain', {}, language)}</ArcadeButton>
          </div>
        </section>
      </div>
    </main>
  );
}
