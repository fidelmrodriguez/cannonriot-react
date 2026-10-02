import { LANGUAGES, t, type Language } from '../i18n';

interface Props {
  musicMuted: boolean;
  sfxMuted: boolean;
  language: Language;
  onToggleMusic(): void;
  onToggleSfx(): void;
  onLanguage(language: Language): void;
}

function MusicIcon({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>{muted && <path d="M3 3l18 18" className="mute-slash"/>}</svg>;
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9c1 1 1 5 0 6M18.5 6.5c3 3 3 8 0 11"/>{muted && <path d="M3 3l18 18" className="mute-slash"/>}</svg>;
}

export function AudioDock({ musicMuted, sfxMuted, language, onToggleMusic, onToggleSfx, onLanguage }: Props) {
  return <aside className="audio-dock" aria-label={t('audio.quick', {}, language)}>
    <div className="language-dock" aria-label={t('language.select', {}, language)}>
      {LANGUAGES.map((item) => <button
        key={item.id}
        type="button"
        className={`language-button ${language === item.id ? 'active' : ''}`}
        aria-pressed={language === item.id}
        aria-label={`${item.flag} ${item.short}`}
        title={`${item.flag} ${item.short}`}
        onClick={() => onLanguage(item.id)}
      >
        <span className="flag" aria-hidden="true">{item.flag}</span><small>{item.short}</small>
      </button>)}
    </div>
    <button
      type="button"
      className={musicMuted ? 'muted' : ''}
      aria-pressed={musicMuted}
      aria-label={musicMuted ? t('audio.musicOn', {}, language) : t('audio.musicOff', {}, language)}
      title={musicMuted ? t('audio.musicOn', {}, language) : t('audio.musicOff', {}, language)}
      onClick={onToggleMusic}
    >
      <MusicIcon muted={musicMuted}/>
    </button>
    <button
      type="button"
      className={sfxMuted ? 'muted' : ''}
      aria-pressed={sfxMuted}
      aria-label={sfxMuted ? t('audio.sfxOn', {}, language) : t('audio.sfxOff', {}, language)}
      title={sfxMuted ? t('audio.sfxOn', {}, language) : t('audio.sfxOff', {}, language)}
      onClick={onToggleSfx}
    >
      <SpeakerIcon muted={sfxMuted}/>
    </button>
  </aside>;
}
