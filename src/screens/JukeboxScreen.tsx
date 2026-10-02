import { ALL_MUSIC_TRACKS, type MusicTrack } from '../audio/music';
import { ArcadeButton } from '../components/ArcadeButton';
import { localizedTrackTitle, t, type Language } from '../i18n';

function categoryLabel(track: MusicTrack, language: Language): string {
  if (track.kind === 'menu') return t('jukebox.cat.menu', {}, language);
  if (track.kind === 'result-defeat') return t('jukebox.cat.defeat', {}, language);
  if (track.kind === 'result-victory') return t('jukebox.cat.victory', {}, language);
  return t('jukebox.cat.battle', {}, language);
}

export function JukeboxScreen({
  language,
  musicMuted,
  selectedId,
  playing,
  onPlayTrack,
  onToggleSelected,
  onBack,
}: {
  language: Language;
  musicMuted: boolean;
  selectedId: string | null;
  playing: boolean;
  onPlayTrack(track: MusicTrack): void;
  onToggleSelected(): void;
  onBack(): void;
}) {
  const selectedTrack = selectedId ? ALL_MUSIC_TRACKS.find((track) => track.id === selectedId) : undefined;
  return (
    <main className="jukebox-screen">
      <div className="jukebox-noise" aria-hidden="true" />
      <section className="jukebox-card">
        <header className="jukebox-header">
          <div>
            <p className="eyebrow">{t('jukebox.eyebrow', {}, language)}</p>
            <h1>{t('jukebox.title', {}, language)}</h1>
            <p>{t('jukebox.desc', {}, language)}</p>
          </div>
          <div className="jukebox-speaker" aria-hidden="true">♫</div>
        </header>

        {musicMuted && <div className="jukebox-muted-warning">{t('jukebox.muted', {}, language)}</div>}

        <div className="jukebox-list" role="list" aria-label={t('jukebox.list', {}, language)}>
          {ALL_MUSIC_TRACKS.map((track, index) => {
            const active = selectedId === track.id;
            return (
              <button
                key={track.id}
                type="button"
                className={`jukebox-track ${active ? 'active' : ''}`}
                onClick={() => onPlayTrack(track)}
                role="listitem"
              >
                <span className="jukebox-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="jukebox-track-copy">
                  <strong>{localizedTrackTitle(track.id, language)}</strong>
                  <small>{categoryLabel(track, language)}</small>
                </span>
                <span className="jukebox-playmark">{active && playing ? '▶' : '♪'}</span>
              </button>
            );
          })}
        </div>

        <footer className="jukebox-footer">
          <div className="jukebox-now-playing">
            <small>{t('jukebox.now', {}, language)}</small>
            <strong>{selectedTrack ? localizedTrackTitle(selectedTrack.id, language) : t('jukebox.choose', {}, language)}</strong>
            {selectedId && <button type="button" disabled={musicMuted} onClick={onToggleSelected}>{playing ? t('jukebox.pause', {}, language) : t('jukebox.resume', {}, language)}</button>}
          </div>
          <ArcadeButton className="secondary" onClick={onBack}>{t('jukebox.back', {}, language)}</ArcadeButton>
        </footer>
      </section>
    </main>
  );
}
