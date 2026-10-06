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

- wallpapers de menu e resultado (`1664×896`, WebP otimizado);
- sprite de gameplay do Kraken neutro-hostil (`512×265`, PNG transparente em `png/default/enemies/kraken.png`);
- cinco portraits de dano e cinco de vitória (`640×640`, `react-damage-*` / `react-victory-*`);
- dois portraits de atrito de casco (`640×640`, `react-friction-01.png` / `react-friction-02.png`) na cor chartreuse dedicada à mecânica;
- dez portraits idle otimizados (`724×543`, `react-idle-*`);
- seis portraits de mecânica otimizados (`640×640`, `react-mechanic-*`);
- dois portraits de evento do Kraken (`640×640`, `react-kraken-alert.png` / `react-kraken-relief.png`);
- SVGs das bandeiras EUA/Brasil/Espanha para idioma;
- SFX de hit, colisão, pickup, dash e reação idle; o surgimento do Kraken usa `kraken_react_chirp.wav`, enquanto o react de alívio quando ele morre sem kill do jogador reutiliza `idle_captain_chirp.wav`;
- músicas de menu/resultado e sete faixas de batalha.

As ilustrações source dos reacts foram reduzidas porque aparecem como portraits pequenos dentro da arena 1280×720. Isso reduz download/decode/memória de GPU mantendo mais pixels do que a apresentação em tela exige.

## Visuais gerados em runtime

Camadas de profundidade da água, caustics, reefs, wavelets, ripples, geometria/vegetação das ilhas, barris, wakes, glows, action lines, trails de projéteis, fumaça/faíscas e boa parte das decorações da arena são geradas/compostas com `PixiJS Graphics`.

A geometria de colisão é separada da arte decorativa, então reduções visuais mobile não alteram gameplay.

## Pipeline de carregamento

O preloader bloqueante carrega apenas texturas essenciais do gameplay, a cena do menu e SFX antes do uso normal do menu.

- Texturas Pixi obrigatórias: concorrência adaptativa (2 em hardware limitado e até 3 nos demais), até 3 tentativas por arquivo.
- Cena do menu: `Image` do DOM; wallpapers de menu/resultado usam WebP.
- SFX: `fetch` para object URLs reutilizáveis.
- Portraits de reação: decode Pixi lazy; dispositivos capazes aquecem apenas o cache HTTP, um arquivo por vez, depois do boot.
- Cenas de resultado: carregamento DOM adiado.
- Músicas de batalha/resultado/jukebox: streaming sob demanda, sem blobs no boot.
- Progresso é enviado à tela de boot. Em 100%, **Subir a bordo** fornece o gesto explícito exigido para áudio.
- Falhas permanentes de assets obrigatórios emitem `[Cannon Riot preload]` e fazem `HEAD` antes da tela de retry.
- Os caminhos permanecem estáveis; nenhuma query string de cache-busting é adicionada.

`GameEngine` reutiliza defensivamente o cache Pixi das texturas essenciais e só carrega um portrait quando aquele painel realmente é pedido.
