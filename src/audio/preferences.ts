export interface AudioPreferences {
  musicMuted: boolean;
  sfxMuted: boolean;
}

const STORAGE_KEY = 'cannon-riot-audio-preferences-v1';

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  musicMuted: false,
  sfxMuted: false,
};

export function loadAudioPreferences(): AudioPreferences {
  if (typeof window === 'undefined') return DEFAULT_AUDIO_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AUDIO_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AudioPreferences>;
    return {
      musicMuted: Boolean(parsed.musicMuted),
      sfxMuted: Boolean(parsed.sfxMuted),
    };
  } catch {
    return DEFAULT_AUDIO_PREFERENCES;
  }
}

export function saveAudioPreferences(preferences: AudioPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage is optional; audio still works for the current session.
  }
}

export function isSfxMuted(): boolean {
  return loadAudioPreferences().sfxMuted;
}
