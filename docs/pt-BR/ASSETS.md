# Assets

## Conjunto de assets em runtime

A pasta `public/assets/` foi reduzida para conter apenas arquivos realmente referenciados pela aplicação. Uma checagem do repositório confirma que todo caminho de asset restante é utilizado.

### Assets de gameplay derivados do desafio

- `png/default/ships/ship_6.png` — navio do jogador
- `png/default/ships/ship_16.png` — Chaser
- `png/default/ships/ship_22.png` — Shooter
- `png/default/ship_parts/cannon_ball.png` — projétil
- `png/default/effects/explosion_1.png` — efeito de destruição
- `png/default/effects/fire_1.png` — chama de casco danificado
- WAVs de canhão/explosão fornecidos e usados como feedback de combate

### Assets adicionais do projeto

- wallpapers de menu/resultado;
- retratos de reação de dano/vitória/idle/mecânicas;
- SFX gerados/editados para hit, colisão, pickup, dash e reação idle;
- faixas de música de menu/resultado/batalha.

## Visuais gerados em runtime

Camadas de profundidade da água, geometria/vegetação das ilhas, barris de pólvora, rastros, glows, linhas de ação, apresentação em arco dos projéteis, fumaça/faíscas e a maior parte das decorações de HUD são geradas/compostas em runtime com `PixiJS Graphics`. Isso evita variantes estáticas desnecessárias e mantém colisões independentes da arte decorativa.

## Carregamento

O preloader global carrega texturas do jogo, wallpapers, SFX e trilha sonora antes da navegação normal pelo menu. Áudio é obtido como object URLs e reutilizado pelo controlador de áudio. Texturas Pixi são carregadas via `Assets` e reutilizadas via `Texture.from`.
