import { ArcadeButton } from './ArcadeButton';
import { t, type Language } from '../i18n';

export function BootScreen({ progress, stage, error, ready, language, onRetry, onEnter }: {
  progress: number;
  stage: string;
  error: string | null;
  ready: boolean;
  language: Language;
  onRetry(): void;
  onEnter(): void;
}) {
  const percent = Math.round(progress * 100);
  return <main className="boot-screen" role="status" aria-live="polite">
    <div className="boot-noise" aria-hidden="true" />
    <section className="boot-card">
      <p className="boot-kicker">{t('boot.kicker', {}, language)}</p>
      <h1>{error ? t('boot.errorTitle', {}, language) : ready ? t('boot.readyTitle', {}, language) : t('boot.title', {}, language)}</h1>
      {error ? <>
        <p className="boot-error">{error}</p>
        <ArcadeButton onClick={onRetry}>{t('boot.retry', {}, language)}</ArcadeButton>
      </> : ready ? <>
        <p className="boot-note boot-ready-note">{t('boot.readyNote', {}, language)}</p>
        <ArcadeButton onClick={onEnter}>{t('boot.enter', {}, language)}</ArcadeButton>
      </> : <>
        <div className="boot-track" aria-label={`${percent}%`}><i style={{ width: `${percent}%` }} /></div>
        <div className="boot-meta"><strong>{percent}%</strong><span>{t(stage, {}, language)}</span></div>
        <p className="boot-note">{t('boot.note', {}, language)}</p>
      </>}
    </section>
  </main>;
}
