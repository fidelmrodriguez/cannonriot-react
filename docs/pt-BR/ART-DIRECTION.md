# Direção de arte

Cannon Riot usa uma apresentação de quadrinhos pirata com papel creme, tinta azul-marinho escura, acentos coral/vermelho, amarelo, roxo de power-up e tratamento de halftone/ruído. O objetivo é manter as telas conectadas visualmente à capitã ilustrada sem perder leitura da arena Pixi em combate denso.

A UI usa bordas irregulares, sombras deslocadas e painéis de pôster, mas o texto interativo permanece geometricamente estável no hover para a tipografia condensada/pixelada não borrar com transforms subpixel.

## Regras de legibilidade

- O mundo de combate mantém coordenadas fixas 1280×720.
- Barras de vida ficam presas aos navios; score/tempo/recargas ficam nas camadas React do HUD.
- Projéteis do jogador/inimigos, dano, explosão e pickups usam acentos visuais diferentes.
- Inimigos recém-spawnados recebem um `!` curto preso ao navio. É somente visual e não atrasa a IA.
- Painéis de reação evitam a zona imediata de segurança do jogador e tentam não sobrepor outros painéis ativos.
- O dock global de idioma/áudio fica visualmente separado do conteúdo principal de menu/resultado.
- Layouts mobile/tablet podem rolar painéis que não cabem verticalmente em vez de esconder conteúdo necessário.

## Composição desktop vs touch

Desktop mantém a composição cinematográfica de wallpaper e densidade decorativa completa. Layouts touch/coarse-pointer são reorganizados apenas em breakpoints touch: menu/painéis recebem espaçamento/scroll seguros e o gameplay usa um D-pad compacto de cinco zonas + dash à esquerda e artilharia à direita; as diagonais superiores são zonas explícitas de avançar+girar com um único polegar.

O renderer mobile reduz de propósito decoração de água/efeitos e ignora blur filters pesados. A direção de arte é preservada por forma, contraste e cor, sem exigir pós-processamento de desktop em celulares mais fracos.

## Pseudo-profundidade

A profundidade é criada sem alterar a geometria de colisão:

- camadas de oceano, caustics, reefs, ripples e wavelets;
- sombras de ilha e vegetação decorativa;
- sombras/contornos dos navios, wakes e bursts de impacto;
- sombras/glows/trails dos projéteis;
- sombras deslocadas dos cartões de papel na UI React.

Mobile reduz quantidade de camadas/partículas decorativas, mas nunca muda colliders autoritativos.

## Painéis de reação

Quatro famílias são usadas:

- **damage** — dano no casco do jogador;
- **victory** — destruição pontuável/combo;
- **idle** — reações da capitã em períodos calmos;
- **mechanic** — dash, medicina, Pólvora Viva, vento, armadura e barril.

O chirp idle da capitã é exclusivo dos painéis idle. Painéis de mecânica usam o SFX da própria ação para dash/pickup não reproduzirem a voz idle junto.
