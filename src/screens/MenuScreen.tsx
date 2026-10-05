import { useMemo, useState, type ReactNode } from 'react';
import { useHistory, useRanking } from '../queries/useMatches';
import type { GameConfig } from '../types/game';
import type { PlayerIdentity } from '../storage/player.storage';
import { ArcadeButton } from '../components/ArcadeButton';
import { getLocale, t, type Language } from '../i18n';

export function MenuScreen({ config, language, player, onPlayerNameChange, onPlay, onOptions }: { config: GameConfig; language: Language; player: PlayerIdentity; onPlayerNameChange(name: string): void; onPlay(): void; onOptions(): void }) {
  const [tab, setTab] = useState<'home'|'ranking'|'history'>('home');
  const [rankingPage, setRankingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const ranking = useRanking(rankingPage, config.sessionTime, config.enemySpawnTime, tab === 'ranking');
  const history = useHistory(historyPage, player.id, tab === 'history');
  const subtitle = useMemo(() => t('menu.ruleValue', { session: config.sessionTime, spawn: config.enemySpawnTime }, language), [config, language]);

  return <main className="menu-screen">
    <div className="menu-wallpaper" aria-hidden="true" />
    <div className="menu-wallpaper-shade" aria-hidden="true" />
    <div className="menu-noise" />
    <div className="menu-scribble scribble-a" aria-hidden="true" />
    <div className="menu-scribble scribble-b" aria-hidden="true" />

    <div className="menu-layout">
      <section className="menu-left-rail">
        <header className="brand-lockup brand-lockup-side">
          <span className="brand-kicker">{t('menu.kicker', {}, language)}</span>
          <h1><i>CANNON</i> RIOT!</h1>
          <p><b>{t('menu.strap1', {}, language)}</b> {t('menu.strap2', {}, language)} <strong>{t('menu.strap3', {}, language)}</strong></p>
        </header>

        <section className="menu-intro-card quick-start-card">
          <div className="rules-badge">{t('menu.rules', {}, language)} <b>{subtitle}</b></div>
          <h2><span>{t('menu.hero1', {}, language)}</span><em>{t('menu.hero2', {}, language)}</em></h2>
          <p>{t('menu.desc', {}, language)}</p>
          <label className="player-identity-card">
            <span>{t('menu.player', {}, language)}</span>
            <input aria-label={t('menu.player', {}, language)} value={player.displayName} maxLength={24} placeholder={t('menu.playerPlaceholder', {}, language)} onChange={(event) => onPlayerNameChange(event.target.value)} />
            <small>{t('menu.playerHelp', {}, language)}</small>
          </label>
          <div className="play-zone"><ArcadeButton className="mega" disabled={!player.displayName.trim()} onClick={onPlay}>{t('menu.play', {}, language)}</ArcadeButton></div>
          <button className="options-link" onClick={onOptions}><span aria-hidden="true">⚙</span><strong>{t('menu.options', {}, language)}</strong></button>
          <div className="control-grid">
            <span><kbd>W / ↑</kbd> {t('menu.ctrlForward', {}, language)}</span><span><kbd>A / D</kbd> {t('menu.ctrlTurn', {}, language)}</span><span><kbd>SPACE</kbd> {t('menu.ctrlFront', {}, language)}</span><span><kbd>Q / E</kbd> {t('menu.ctrlSide', {}, language)}</span><span><kbd>F</kbd> {t('menu.ctrlDash', {}, language)}</span><span><kbd>R</kbd> {t('menu.ctrlBarrel', {}, language)}</span><span><kbd>P / ESC</kbd> {t('menu.ctrlPause', {}, language)}</span>
          </div>
          <div className="touch-menu-hint" aria-label={t('touch.controls', {}, language)}><b>{t('menu.touch', {}, language)}</b><span>{t('menu.touchHint', {}, language)}</span></div>
        </section>
      </section>

      <div className="menu-center-lane" aria-hidden="true" />

      <section className="menu-right-rail">
        <section className="menu-card menu-side-card">
          <nav className="tabs" aria-label={t('menu.tips', {}, language)}>
            <button className={tab==='home'?'active':''} onClick={()=>setTab('home')}>{t('menu.tips', {}, language)}</button>
            <button className={tab==='ranking'?'active':''} onClick={()=>setTab('ranking')}>{t('menu.ranking', {}, language)}</button>
            <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}>{t('menu.history', {}, language)}</button>
          </nav>

          {tab === 'home' && <div className="home-pane home-pane-side-info">
            <p className="eyebrow">{t('menu.orders', {}, language)}</p>
            <h2><span>{t('menu.orders1', {}, language)}</span><em>{t('menu.orders2', {}, language)}</em></h2>
            <p>{t('menu.ordersDesc', {}, language)}</p>
            <div className="menu-bullet-list">
              <span><b>01</b> {t('menu.tip1', {}, language)}</span>
              <span><b>02</b> {t('menu.tip2', {}, language)}</span>
              <span><b>03</b> {t('menu.tip3', {}, language)}</span>
              <span><b>04</b> {t('menu.tip4', {}, language)}</span>
            </div>
          </div>}

          {tab === 'ranking' && <DataPanel language={language} title={t('menu.ranking', {}, language)} subtitle={t('menu.rankingDesc', { rules: subtitle }, language)} loading={ranking.isLoading} error={ranking.isError ? t('api.rankingUnavailable', {}, language) : undefined} empty={!ranking.data?.items.length}>
            <ol className="ranking-list">{ranking.data?.items.map((entry) => <li key={entry.matchId}><b>#{entry.rank}</b><span>{entry.playerName}</span><strong>{entry.score}</strong><small>{entry.duration}s</small></li>)}</ol>
            <Pager language={language} page={ranking.data?.page ?? rankingPage} total={ranking.data?.totalPages ?? 1} onPage={setRankingPage}/>
          </DataPanel>}

          {tab === 'history' && <DataPanel language={language} title={t('menu.historyTitle', {}, language)} subtitle={t('menu.historyDesc', {}, language)} loading={history.isLoading} error={history.isError ? t('api.historyUnavailable', {}, language) : undefined} empty={!history.data?.items.length}>
            <div className="history-list">{history.data?.items.map((entry) => <article key={entry.matchId}><time>{new Date(entry.playedAt).toLocaleString(getLocale(language))}</time><strong>{entry.score} pts</strong><span>{entry.duration}s · {entry.endReason === 'timeout' ? t('menu.historyTimeout', {}, language) : t('menu.historyDestroyed', {}, language)}</span><small>{entry.config.sessionTime}s / spawn {entry.config.enemySpawnTime}s</small></article>)}</div>
            <Pager language={language} page={history.data?.page ?? historyPage} total={history.data?.totalPages ?? 1} onPage={setHistoryPage}/>
          </DataPanel>}
        </section>
      </section>
    </div>

    <footer className="menu-footer">{t('menu.footer', {}, language)}</footer>
  </main>;
}

function DataPanel({ language, title, subtitle, loading, error, empty, children }: { language:Language; title:string; subtitle:string; loading:boolean; error?:string; empty:boolean; children:ReactNode }) {
  return <section className="data-pane"><div><p className="eyebrow">{t('menu.remoteData', {}, language)}</p><h2>{title}</h2><p>{subtitle}</p></div>{loading ? <div className="state-box">{t('menu.loading', {}, language)}</div> : error ? <div className="state-box error-copy">{error}</div> : empty ? <div className="state-box">{t('menu.empty', {}, language)}</div> : children}</section>;
}
function Pager({ language, page, total, onPage }: { language:Language; page:number; total:number; onPage(n:number):void }) { return <div className="pager"><button disabled={page<=1} onClick={()=>onPage(page-1)}>←</button><span>{t('menu.page', { page, total }, language)}</span><button disabled={page>=total} onClick={()=>onPage(page+1)}>→</button></div>; }
