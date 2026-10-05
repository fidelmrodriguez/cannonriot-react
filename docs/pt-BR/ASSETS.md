# Assets

## Conjunto de assets em runtime

`public/assets/` contém os arquivos referenciados pela aplicação. `public/assets/asset-manifest.json` é um inventário/metadado; ele não é necessário para o carregamento em runtime. Durante esta revisão da documentação, bytes, hashes e dimensões de imagem foram atualizados para corresponder aos arquivos otimizados atuais.

### Assets de gameplay derivados do desafio

- `png/default/ships/ship_6.png` — navio do jogador;
- `png/default/ships/ship_16.png` — Chaser;
- `png/default/ships/ship_22.png` — Shooter;
- `png/default/ship_parts/cannon_ball.png` — projétil;
- `png/default/effects/explosion_1.png` — efeito de destruição;
- `png/default/effects/fire_1.png` — chama de casco danificado;
- WAVs fornecidos de canhão/lateral/explosão usados no feedback de combate.

### Assets específicos do projeto

- wallpapers de menu e resultado (`1672×941`);
- cinco portraits de dano e cinco de vitória (`640×640`, `react-damage-*` / `react-victory-*`);
- dois portraits de atrito de casco (`640×640`, `react-friction-01.png` / `react-friction-02.png`) na cor chartreuse dedicada à mecânica;
- dez portraits idle otimizados (`724×543`, `react-idle-*`);
- seis portraits de mecânica otimizados (`640×640`, `react-mechanic-*`);
- SVGs das bandeiras EUA/Brasil/Espanha para idioma;
- SFX de hit, colisão, pickup, dash e reação idle;
- músicas de menu/resultado e sete faixas de batalha.

As ilustrações source dos reacts foram reduzidas porque aparecem como portraits pequenos dentro da arena 1280×720. Isso reduz download/decode/memória de GPU mantendo mais pixels do que a apresentação em tela exige.

## Visuais gerados em runtime

Camadas de profundidade da água, caustics, reefs, wavelets, ripples, geometria/vegetação das ilhas, barris, wakes, glows, action lines, trails de projéteis, fumaça/faíscas e boa parte das decorações da arena são geradas/compostas com `PixiJS Graphics`.

A geometria de colisão é separada da arte decorativa, então reduções visuais mobile não alteram gameplay.

## Pipeline de carregamento

O preloader global carrega todas as texturas declaradas, wallpapers de tela, SFX e trilha antes do uso normal do menu.

- Texturas Pixi: concorrência 3, até 3 tentativas por arquivo.
- Imagens de tela: `Image` do DOM.
- Áudio/música: `fetch` para object URLs reutilizáveis.
- Progresso é enviado à tela de boot. Em 100%, o preload permanece num gate **Subir a bordo** para fornecer ao navegador um gesto explícito antes de iniciar a música do menu.
- Falhas permanentes emitem logs `[Cannon Riot preload]` e fazem um `HEAD` para expor status/headers HTTP antes da tela de retry.
- Caminhos de imagem permanecem originais; não é adicionada query string de cache-busting.

`GameEngine` usa `Texture.from()`/URLs pré-carregadas depois do boot, em vez de baixar uma cópia por entidade/efeito.
