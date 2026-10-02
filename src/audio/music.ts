export type MusicTrackKind = 'menu' | 'result-defeat' | 'result-victory' | 'battle';

export interface MusicTrack {
  id: string;
  title: string;
  kind: MusicTrackKind;
  src: string;
  volume: number;
}

export const MENU_TRACK: MusicTrack = {
  id: 'menu-nevoa-rosa-horizonte',
  title: 'Névoa Rosa no Horizonte',
  kind: 'menu',
  src: '/assets/music/nevoa-rosa-no-horizonte.mp3',
  volume: 0.22,
};

export const RESULT_DEFEAT_TRACK: MusicTrack = {
  id: 'result-cartas-mar-nao-devolve',
  title: 'Cartas que o Mar Não Devolve',
  kind: 'result-defeat',
  src: '/assets/music/cartas-que-o-mar-nao-devolve.mp3',
  volume: 0.19,
};

export const RESULT_VICTORY_TRACK: MusicTrack = {
  id: 'result-sol-linha-dagua',
  title: "Sol Sobre a Linha d'Água",
  kind: 'result-victory',
  src: '/assets/music/sol-sobre-a-linha-dagua.mp3',
  volume: 0.21,
};

export const BATTLE_TRACKS: MusicTrack[] = [
  {
    id: 'battle-bala-rosa',
    title: 'Bala Rosa em Mar Revolto',
    kind: 'battle',
    src: '/assets/music/battle/bala-rosa-em-mar-revolto.mp3',
    volume: 0.2,
  },
  {
    id: 'battle-mare-feedback',
    title: 'Maré de Feedback',
    kind: 'battle',
    src: '/assets/music/battle/mare-de-feedback.mp3',
    volume: 0.2,
  },
  {
    id: 'battle-bruma-conves',
    title: 'Bruma no Convés',
    kind: 'battle',
    src: '/assets/music/battle/bruma-no-conves.mp3',
    volume: 0.2,
  },
  {
    id: 'battle-cordas-bombordo',
    title: 'Cordas de Bombordo',
    kind: 'battle',
    src: '/assets/music/battle/cordas-de-bombordo.mp3',
    volume: 0.2,
  },
  {
    id: 'battle-sino-perseguicao',
    title: 'Sino de Perseguição',
    kind: 'battle',
    src: '/assets/music/battle/sino-de-perseguicao.mp3',
    volume: 0.2,
  },
  {
    id: 'battle-motim-neblina',
    title: 'Motim na Neblina',
    kind: 'battle',
    src: '/assets/music/battle/motim-na-neblina.mp3',
    volume: 0.2,
  },
  {
    id: 'battle-canhoes-mare',
    title: 'Canhões Contra a Maré',
    kind: 'battle',
    src: '/assets/music/battle/canhoes-contra-a-mare.mp3',
    volume: 0.2,
  },
];

export const ALL_MUSIC_TRACKS: MusicTrack[] = [
  MENU_TRACK,
  RESULT_DEFEAT_TRACK,
  RESULT_VICTORY_TRACK,
  ...BATTLE_TRACKS,
];
