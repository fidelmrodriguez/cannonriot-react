import { useCallback, useEffect, useRef, useState } from 'react';
import { MenuScreen } from './screens/MenuScreen';
import { OptionsScreen } from './screens/OptionsScreen';
import { GameScreen } from './screens/GameScreen';
import { ResultScreen } from './screens/ResultScreen';
import { JukeboxScreen } from './screens/JukeboxScreen';
import { AudioDock } from './components/AudioDock';
import { LandscapeLock } from './components/LandscapeLock';
import { BootScreen } from './components/BootScreen';
import { loadSettings, saveSettings } from './storage/settings.storage';
import { matchStorage } from './storage/match.storage';
import type { EndReason, GameConfig, MatchResult } from './types/game';
import { useRegisterMatch } from './queries/useMatches';
import { BATTLE_TRACKS, MENU_TRACK, RESULT_DEFEAT_TRACK, RESULT_VICTORY_TRACK, type MusicTrack } from './audio/music';
import { loadAudioPreferences, saveAudioPreferences, type AudioPreferences } from './audio/preferences';
import { getPreloadedAudioUrl, preloadAllAssets, preloadDeferredAssets } from './preload';
import { getLanguage, setLanguage as setGlobalLanguage, t, type Language } from './i18n';
import { loadPlayerIdentity, savePlayerIdentity, type PlayerIdentity } from './storage/player.storage';

type Screen = 'menu' | 'options' | 'jukebox' | 'game' | 'result';

type AudioController = {
  jukeboxSelectedId: string | null;
  jukeboxPlaying: boolean;
  playJukeboxTrack(track: MusicTrack): void;
  toggleJukeboxSelected(): void;
};

function shuffledIndexes(length: number, avoidFirst = -1): number[] {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j]!, indexes[i]!];
  }
  if (indexes.length > 1 && indexes[0] === avoidFirst) {
    [indexes[0], indexes[1]] = [indexes[1]!, indexes[0]!];
  }
  return indexes;
}

function useAudioController(screen: Screen, resultEndReason: EndReason | null, musicMuted: boolean, enabled: boolean): AudioController {
  const menuRef = useRef<HTMLAudioElement | null>(null);
  const resultRef = useRef<HTMLAudioElement | null>(null);
  const battleRef = useRef<HTMLAudioElement | null>(null);
  const jukeboxRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  const musicMutedRef = useRef(musicMuted);
  const screenRef = useRef<Screen>(screen);
  const resultEndReasonRef = useRef<EndReason | null>(resultEndReason);
  const previousScreenRef = useRef<Screen>(screen);
  const battleBagRef = useRef<number[]>([]);
  const battleCursorRef = useRef(0);
  const lastBattleIndexRef = useRef(-1);
  const selectedTrackRef = useRef<MusicTrack | null>(null);
  const [jukeboxSelectedId, setJukeboxSelectedId] = useState<string | null>(null);
  const [jukeboxPlaying, setJukeboxPlaying] = useState(false);

  resultEndReasonRef.current = resultEndReason;

  const stopAndReset = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) return;
    audio.pause();
    try { audio.currentTime = 0; } catch { /* source may not be ready yet */ }
  }, []);

  const loadNextBattleTrack = useCallback((newRun: boolean) => {
    const audio = battleRef.current;
    if (!audio || BATTLE_TRACKS.length === 0) return;

    if (newRun || battleBagRef.current.length === 0 || battleCursorRef.current >= battleBagRef.current.length) {
      battleBagRef.current = shuffledIndexes(BATTLE_TRACKS.length, lastBattleIndexRef.current);
      battleCursorRef.current = 0;
    }

    const trackIndex = battleBagRef.current[battleCursorRef.current]!;
    battleCursorRef.current += 1;
    lastBattleIndexRef.current = trackIndex;
    const track = BATTLE_TRACKS[trackIndex]!;

    audio.pause();
    audio.src = getPreloadedAudioUrl(track.src);
    audio.volume = track.volume;
    audio.currentTime = 0;
    audio.load();

    if (unlockedRef.current && !musicMutedRef.current && screenRef.current === 'game') {
      void audio.play().catch(() => undefined);
    }
  }, []);

  const resumeCurrentScreen = useCallback(() => {
    if (!unlockedRef.current || musicMutedRef.current) return;
    const current = screenRef.current;

    if (current === 'menu' || current === 'options') {
      const audio = menuRef.current;
      if (!audio) return;
      audio.volume = MENU_TRACK.volume;
      void audio.play().catch(() => undefined);
      return;
    }

    if (current === 'result') {
      const audio = resultRef.current;
      if (!audio || !audio.src) return;
      void audio.play().catch(() => undefined);
      return;
    }

    if (current === 'game') {
      const audio = battleRef.current;
      if (!audio) return;
      if (!audio.src) loadNextBattleTrack(true);
      else void audio.play().catch(() => undefined);
      return;
    }

    if (current === 'jukebox') {
      const audio = jukeboxRef.current;
      if (!audio || !selectedTrackRef.current) return;
      void audio.play().then(() => setJukeboxPlaying(true)).catch(() => setJukeboxPlaying(false));
    }
  }, [loadNextBattleTrack]);

  useEffect(() => {
    if (!enabled) return;

    const menu = new Audio(getPreloadedAudioUrl(MENU_TRACK.src));
    const result = new Audio();
    const battle = new Audio();
    const jukebox = new Audio();

    menu.loop = true;
    result.loop = true;
    battle.loop = false;
    jukebox.loop = true;
    menu.preload = 'auto';
    result.preload = 'metadata';
    battle.preload = 'metadata';
    jukebox.preload = 'metadata';
    menu.volume = MENU_TRACK.volume;

    menu.load();
    result.load();

    menuRef.current = menu;
    resultRef.current = result;
    battleRef.current = battle;
    jukeboxRef.current = jukebox;

    const onBattleEnded = () => {
      if (screenRef.current !== 'game' || musicMutedRef.current || !unlockedRef.current) return;
      loadNextBattleTrack(false);
    };
    battle.addEventListener('ended', onBattleEnded);

    const unlockAudio = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      resumeCurrentScreen();
    };

    document.addEventListener('pointerdown', unlockAudio, { passive: true });
    document.addEventListener('keydown', unlockAudio);

    return () => {
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      battle.removeEventListener('ended', onBattleEnded);
      stopAndReset(menu);
      stopAndReset(result);
      stopAndReset(battle);
      stopAndReset(jukebox);
      menuRef.current = null;
      resultRef.current = null;
      battleRef.current = null;
      jukeboxRef.current = null;
      unlockedRef.current = false;
    };
  }, [enabled, loadNextBattleTrack, resumeCurrentScreen, stopAndReset]);

  useEffect(() => {
    if (!enabled) return;
    screenRef.current = screen;
    const previous = previousScreenRef.current;
    previousScreenRef.current = screen;
    if (previous === screen) return;

    const wasMenuFamily = previous === 'menu' || previous === 'options';
    const isMenuFamily = screen === 'menu' || screen === 'options';

    // Menu <-> Options is intentionally seamless: same track, same timestamp.
    if (wasMenuFamily && isMenuFamily) return;

    if (screen === 'jukebox') {
      menuRef.current?.pause();
      resultRef.current?.pause();
      battleRef.current?.pause();
      setJukeboxPlaying(false);
      return;
    }

    if (previous === 'jukebox') {
      stopAndReset(jukeboxRef.current);
      selectedTrackRef.current = null;
      setJukeboxSelectedId(null);
      setJukeboxPlaying(false);

      if (isMenuFamily) {
        stopAndReset(menuRef.current);
        resumeCurrentScreen();
        return;
      }
    }

    if (screen === 'game') {
      stopAndReset(menuRef.current);
      stopAndReset(resultRef.current);
      stopAndReset(battleRef.current);
      battleBagRef.current = [];
      battleCursorRef.current = 0;
      loadNextBattleTrack(true);
      return;
    }

    if (screen === 'result') {
      stopAndReset(menuRef.current);
      stopAndReset(battleRef.current);
      stopAndReset(resultRef.current);
      const resultTrack = resultEndReasonRef.current === 'timeout' ? RESULT_VICTORY_TRACK : RESULT_DEFEAT_TRACK;
      const resultAudio = resultRef.current;
      if (resultAudio) {
        resultAudio.src = getPreloadedAudioUrl(resultTrack.src);
        resultAudio.volume = resultTrack.volume;
        resultAudio.currentTime = 0;
        resultAudio.load();
      }
      resumeCurrentScreen();
      return;
    }

    if (isMenuFamily) {
      stopAndReset(resultRef.current);
      stopAndReset(battleRef.current);
      stopAndReset(menuRef.current);
      resumeCurrentScreen();
    }
  }, [enabled, screen, resultEndReason, loadNextBattleTrack, resumeCurrentScreen, stopAndReset]);

  useEffect(() => {
    musicMutedRef.current = musicMuted;
    if (!enabled) return;

    if (musicMuted) {
      menuRef.current?.pause();
      resultRef.current?.pause();
      battleRef.current?.pause();
      jukeboxRef.current?.pause();
      setJukeboxPlaying(false);
      return;
    }

    resumeCurrentScreen();
  }, [enabled, musicMuted, resumeCurrentScreen]);

  const playJukeboxTrack = useCallback((track: MusicTrack) => {
    selectedTrackRef.current = track;
    setJukeboxSelectedId(track.id);
    const audio = jukeboxRef.current;
    if (!audio) return;

    audio.pause();
    audio.src = getPreloadedAudioUrl(track.src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = Math.min(0.32, track.volume + 0.04);
    audio.currentTime = 0;
    audio.load();

    if (!unlockedRef.current || musicMutedRef.current || screenRef.current !== 'jukebox') {
      setJukeboxPlaying(false);
      return;
    }

    void audio.play().then(() => setJukeboxPlaying(true)).catch(() => setJukeboxPlaying(false));
  }, []);

  const toggleJukeboxSelected = useCallback(() => {
    const audio = jukeboxRef.current;
    if (!audio || !selectedTrackRef.current || musicMutedRef.current) return;

    if (audio.paused) {
      void audio.play().then(() => setJukeboxPlaying(true)).catch(() => setJukeboxPlaying(false));
    } else {
      audio.pause();
      setJukeboxPlaying(false);
    }
  }, []);

  return { jukeboxSelectedId, jukeboxPlaying, playJukeboxTrack, toggleJukeboxSelected };
}

export default function App() {
  const [bootReady, setBootReady] = useState(false);
  const [bootEntered, setBootEntered] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  const [bootStage, setBootStage] = useState('boot.hold');
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [screen, setScreen] = useState<Screen>(() => matchStorage.shouldResumeResult() ? 'result' : 'menu');
  const [config, setConfig] = useState<GameConfig>(() => loadSettings());
  const [result, setResult] = useState<MatchResult | null>(() => matchStorage.getLast());
  const [player, setPlayer] = useState<PlayerIdentity>(() => loadPlayerIdentity());
  const [audioPreferences, setAudioPreferences] = useState<AudioPreferences>(() => loadAudioPreferences());
  const [language, setLanguage] = useState<Language>(() => getLanguage());
  const register = useRegisterMatch();
  const audio = useAudioController(screen, result?.endReason ?? null, audioPreferences.musicMuted, bootReady);

  useEffect(() => {
    let cancelled = false;
    setBootReady(false);
    setBootEntered(false);
    setBootError(null);
    setBootProgress(0);
    setBootStage('boot.hold');
    void preloadAllAssets((progress, label) => {
      if (cancelled) return;
      setBootProgress(progress);
      setBootStage(label);
    }).then(() => {
      if (!cancelled) setBootReady(true);
    }).catch((error) => {
      if (!cancelled) setBootError(error instanceof Error ? error.message : t('boot.genericError'));
    });
    return () => { cancelled = true; };
  }, [bootAttempt]);

  useEffect(() => {
    if (!bootReady) return;
    // Optional assets warm up after the blocking boot has finished. This is
    // deliberately fire-and-forget so the menu stays interactive immediately.
    void preloadDeferredAssets();
  }, [bootReady]);

  useEffect(() => {
    saveAudioPreferences(audioPreferences);
  }, [audioPreferences]);

  const retryOutbox = useCallback(async () => {
    for (const pending of matchStorage.getPending()) {
      try { await register.mutateAsync(pending); } catch { /* outbox intentionally survives */ }
    }
  }, [register.mutateAsync]);

  useEffect(() => {
    void retryOutbox();
  }, [retryOutbox]); // recovery pass on bootstrap

  useEffect(() => {
    if (screen === 'menu') void retryOutbox();
  }, [screen, retryOutbox]); // recovery after the reviewer restores the network and returns to menu

  const handleEnd = useCallback((match: MatchResult) => {
    matchStorage.setLast(match);
    matchStorage.enqueue(match);
    setResult(match);
    setScreen('result');
    register.mutate(match);
  }, [register]);

  const saveConfig = (next: GameConfig) => {
    saveSettings(next);
    setConfig(next);
    setScreen('menu');
  };
  const retrySave = () => {
    if (result && matchStorage.isPending(result.matchId)) register.mutate(result);
  };
  const currentResultPending = result ? matchStorage.isPending(result.matchId) : false;
  const savingCurrentResult = Boolean(result && register.isPending && register.variables?.matchId === result.matchId);
  const saveState: 'saving' | 'saved' | 'failed' = savingCurrentResult && currentResultPending
    ? 'saving'
    : currentResultPending
      ? 'failed'
      : 'saved';

  const toggleMusic = () => setAudioPreferences((current) => ({ ...current, musicMuted: !current.musicMuted }));
  const toggleSfx = () => setAudioPreferences((current) => ({ ...current, sfxMuted: !current.sfxMuted }));
  const changeLanguage = (next: Language) => {
    setGlobalLanguage(next);
    setLanguage(next);
  };

  const changePlayerName = (displayName: string) => {
    const next = { ...player, displayName: displayName.slice(0, 24) };
    setPlayer(next);
    savePlayerIdentity(next);
  };

  const goToMenu = () => {
    matchStorage.dismissResult();
    setScreen('menu');
  };

  const playAgain = () => {
    matchStorage.dismissResult();
    setScreen('game');
  };

  if (!bootReady || !bootEntered) {
    return <div className="app-shell">
      <BootScreen
        progress={bootProgress}
        stage={bootStage}
        error={bootError}
        ready={bootReady && !bootError}
        language={language}
        onRetry={() => setBootAttempt((value) => value + 1)}
        onEnter={() => setBootEntered(true)}
      />
      <AudioDock
        musicMuted={audioPreferences.musicMuted}
        sfxMuted={audioPreferences.sfxMuted}
        language={language}
        onToggleMusic={toggleMusic}
        onToggleSfx={toggleSfx}
        onLanguage={changeLanguage}
      />
      <LandscapeLock />
    </div>;
  }

  return <div className="app-shell">
    {screen === 'menu' && <MenuScreen config={config} language={language} player={player} onPlayerNameChange={changePlayerName} onPlay={() => setScreen('game')} onOptions={() => setScreen('options')} />}
    {screen === 'options' && <OptionsScreen
      config={config}
      language={language}
      audioPreferences={audioPreferences}
      onToggleMusic={toggleMusic}
      onToggleSfx={toggleSfx}
      onSave={saveConfig}
      onBack={() => setScreen('menu')}
      onOpenJukebox={() => setScreen('jukebox')}
    />}
    {screen === 'jukebox' && <JukeboxScreen
      language={language}
      musicMuted={audioPreferences.musicMuted}
      selectedId={audio.jukeboxSelectedId}
      playing={audio.jukeboxPlaying}
      onPlayTrack={audio.playJukeboxTrack}
      onToggleSelected={audio.toggleJukeboxSelected}
      onBack={() => setScreen('options')}
    />}
    {screen === 'game' && <GameScreen config={config} language={language} player={player} onEnd={handleEnd} onQuit={goToMenu} />}
    {screen === 'result' && result && <ResultScreen language={language} result={result} saveState={saveState} onRetry={retrySave} onAgain={playAgain} onMenu={goToMenu} />}

    <AudioDock
      musicMuted={audioPreferences.musicMuted}
      sfxMuted={audioPreferences.sfxMuted}
      language={language}
      onToggleMusic={toggleMusic}
      onToggleSfx={toggleSfx}
      onLanguage={changeLanguage}
      inGame={screen === 'game'}
    />
    <LandscapeLock />
  </div>;
}
