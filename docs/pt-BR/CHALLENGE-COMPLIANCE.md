# Auditoria de conformidade com o desafio

Este documento mapeia a implementação para os requisitos públicos de `junglegaming/game-developer-challenge`.

## Stack

| Requisito | Implementação |
| --- | --- |
| UI em React | Menus, options, ranking/history, resultado, diálogo de pausa, HUD semântico |
| TypeScript strict | `tsconfig.app.json` usa `strict: true` |
| Gameplay em PixiJS | Arena, navios, projéteis, ilhas, efeitos, barras de vida |
| TanStack Query | Queries de ranking/history e mutation de registro de partida |
| Axios | Todas as chamadas HTTP de ranking/history/registro |
| MSW | Worker no browser inicia antes de o app terminar o preload global e roda também no build publicado |
| Playwright | Projetos Chromium desktop + touch landscape |

## Gameplay

- Movimento para frente + rotação esquerda/direita: implementado em `InputManager` + `GameEngine`.
- Tiro frontal: um projétil.
- Salvas laterais: três projéteis paralelos por lado.
- Movimento/disparo simultâneos: estado de ações independentes permite combinações mantidas.
- Vida finita do jogador: dano por projétil e colisão do Chaser.
- Limites visíveis da arena + colisão com ilha: aplicados pelos sistemas de movimento/projétil.
- Chaser: perseguição, rotação, desvio de ilha, dano por colisão + autodestruição.
- Shooter: aproximação/órbita, linha de visão, checagem de alcance, rotação, projétil à distância.
- Os dois tipos em partida normal: sequência determinística alternada de spawn.
- Spawn seguro: validação de obstáculo, distância do jogador e espaçamento entre inimigos; não existe fallback inválido.
- Direção/velocidade/dano/lifetime de projétil: configuração centralizada + estado de entidade.
- Projétil single-hit: removido imediatamente depois do hit.
- Inimigo morto excluído: loops checam `alive`.
- Duração configurável: 60–180 segundos.
- Autodestruição do Chaser não dá ponto; kill por ataque do jogador dá exatamente um ponto.
- Partida congela depois do fim; restart monta engine limpa.
- Barras de vida acima de jogador/inimigos + HUD React de score/tempo.
- Pausa manual e automática; sem auto-resume; input limpo ao pausar.
- Feedback de tiro, explosão, hit e deterioração/dano: implementado.

## Telas/configuração

- Menu principal: Play, Options, controles, Ranking, Match History.
- Options: session time + spawn interval, validação e persistência local.
- Resultado: score, duração efetiva, motivo do fim, estado de registro, Play Again/Main Menu.
- Ranking: identificação do jogador, score, ordenação determinística e paginação.
- Cada `matchId` confirmado permanece como entrada individual do ranking; não existe colapso por jogador.
- History: histórico do jogador local com data, score, duração, end reason e paginação.
- Config de gameplay tipada e centralizada.
- Partida recebe snapshot da configuração no início.
- Recarregar/sair durante combate abandona sem registrar.
- Último resultado concluído é persistido localmente.
- Inglês é a UI padrão da primeira execução; português/espanhol são extras opcionais.

## Arquitetura/ciclo de vida

- Estado contínuo de combate permanece em `GameEngine`; React recebe snapshots limitados.
- Simulação baseada em tempo usa delta em segundos e limita deltas grandes.
- Preload de textura/áudio ocorre antes da navegação normal; loading do jogo também expõe progresso/erro/retry.
- Canvas responsivo preserva coordenadas do mundo e aspect ratio.
- Input/listeners/ticker/`ResizeObserver`/recursos Pixi são limpos no unmount.
- App roda sob React Strict Mode.

## Integridade de ranking/history

- UUID `matchId` é criado uma vez e reutilizado em retry.
- UUID do jogador + display name são persistentes e capturados antes da partida.
- Duração efetiva vem do tempo da simulação.
- Ranking compara exatamente `sessionTime + enemySpawnTime`. Cada `matchId` confirmado permanece entrada individual.
- Desempate determinístico: score desc, duração asc, data asc, match id.
- Query keys TanStack Query incluem config/página para ranking e jogador/página para history.
- `AbortSignal` da query é repassado ao Axios.
- Registro bem-sucedido invalida ranking e history.
- Outbox persistente em array preserva múltiplas partidas pendentes.
- Retry pós-timeout é idempotente no MSW.
- Pendências são reenviadas depois de refresh e ao retornar ao menu.
- Registro pendente não bloqueia Play Again/novas partidas.

## Cobertura de cenários MSW

Cenários implementados:

- sucesso;
- listas vazias;
- múltiplas páginas;
- resposta lenta;
- timeout genérico de request;
- latência variável determinística;
- respostas fora de ordem;
- falha de conexão;
- HTTP 422;
- HTTP 503;
- falha somente no ranking;
- falha somente no history;
- timeout depois de salvar;
- backend indisponível no game over e recuperação.

A tela Options permite selecionar cenários e resetar o estado mock. Registros confirmados e outbox do cliente persistem após refresh. Resetar o banco mock intencionalmente não apaga a outbox do cliente.

## Acessibilidade/comportamento responsivo

- Navegação de teclado usa controles nativos.
- Foco visível é global.
- Inputs/selects têm labels.
- Pausa usa diálogo semântico.
- Score/tempo/vida têm resumo semântico `aria-live`, limitado pelos snapshots React em vez de a cada frame.
- Captura de teclas de gameplay existe somente enquanto `GameScreen` está montado.
- Controles touch aceitam múltiplos pointers e ficam sobrepostos à arena landscape.

## Status das evidências E2E/performance

O repositório contém a suíte Playwright, hook de seed determinística, hook explícito de tempo de simulação e configuração de relatório HTML. O plano de teste inclui regressão visual, porém PNGs baseline reais e números empíricos de profiling precisam ser gerados num navegador/runtime instalado na máquina final de avaliação. Eles não são inventados no código-fonte.

O procedimento exato de profiling está em `docs/pt-BR/PERFORMANCE.md`.

## Evidências ainda necessárias antes da submissão final

A implementação de código está preparada para o desafio, mas três grupos de artefatos voltados ao avaliador dependem do ambiente real e precisam ser produzidos a partir do checkout final, sem inventar resultados:

1. Executar `npm ci`, `npm run check` e `npm run test:e2e` com Chromium instalado; guardar o relatório HTML do Playwright e traces/screenshots de falha.
2. Aprovar e commitar baselines visuais reais do Playwright para menu, arena estável e tela de resultado no navegador/runtime final.
3. Fazer profiling do build otimizado na partida obrigatória de 180 segundos e nos cinco ciclos entrar/jogar/sair; registrar FPS, p95 do intervalo entre frames, pico de entidades, comportamento de heap/recursos, hardware/navegador/viewport e limitações.
4. Fazer deploy deste commit final exato e confirmar que abertura direta + refresh funcionam e que ranking/history via MSW continuam operando na URL pública.

Esses são os únicos itens que o repositório intencionalmente não afirma ter medido neste ambiente.
