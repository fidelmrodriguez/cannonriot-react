# Auditoria de conformidade com o desafio

Este documento mapeia o repositório atual para os requisitos públicos de `junglegaming/game-developer-challenge`:

https://github.com/junglegaming/game-developer-challenge

O desafio exige UI em React, TypeScript strict, gameplay em PixiJS, TanStack Query, Axios, MSW, Playwright, suporte desktop/mobile, fluxos resilientes de ranking/history e evidência documentada de performance.

## Stack

| Requisito | Implementação atual |
| --- | --- |
| UI em React | Menus, Options, jukebox, ranking/history, resultado, pausa, HUD semântico e controles globais |
| TypeScript strict | `tsconfig.app.json` usa `strict: true` |
| Gameplay em PixiJS | Arena, navios, projéteis, ilhas, barras de vida, efeitos, painéis de reação |
| TanStack Query | Queries de ranking/history e mutation de registro |
| Axios | Cliente HTTP de ranking/history/registro com timeout de 3500 ms |
| MSW | Worker no navegador para endpoints de ranking/history/registro, inclusive no build publicado |
| Playwright | Chromium desktop + perfil touch landscape Pixel 7 |

## Gameplay

O comportamento central exigido está implementado:

- movimento para frente + rotação esquerda/direita;
- canhão frontal com um projétil;
- comandos laterais esquerda/direita com três projéteis paralelos;
- movimento + disparo simultâneos por estado de ações independente;
- casco finito reduzido por projéteis inimigos e colisão de Chaser;
- limites visíveis da arena e bloqueio por ilhas;
- perseguição/rotação/colisão/autodestruição do Chaser;
- alcance/linha de visão/rotação/projétil do Shooter;
- padrão determinístico de spawn contendo os dois tipos;
- intervalo configurado com validação de spawn seguro;
- direção/velocidade/dano/lifetime e remoção single-hit de projéteis;
- inimigos destruídos deixam de participar de IA, ataque e colisão;
- duração ativa de 60–180 s;
- exatamente um ponto por destruição pontuável;
- autodestruição de Chaser contra jogador continua sem ponto;
- finais limpos por timeout/casco destruído e restart novo;
- barras de vida nos navios + HUD React de score/tempo;
- pausa manual e por blur/aba oculta com retomada explícita;
- feedback de tiro, impacto, explosão e casco danificado.

Mecânicas adicionais (dash, pickups, auto-fire da Pólvora Viva, barril, suporte de emergência) não alteram a chave obrigatória de ranking nem o valor do ponto.

## Extensões atuais de combate

O repositório atual também implementa:

- lock normal de troca frontal/lateral de 0,25 s + buffer de input rápido de 0,32 s;
- dash de 0,28 s com imunidade somente durante o estado ativo;
- counter de Chaser com dash sem pontuação;
- Pólvora Viva automática em frontal + as duas laterais até expirar;
- pickups Medicina, Vento e Casco Reforçado;
- suporte de emergência de Medicina/Armadura com casco ≤35% e cooldown de 12 s;
- barril com splash de 170 px não letal nos vizinhos e imunidade própria;
- telegraph visual `!` no spawn sem atraso de ataque.

## Telas e configuração

- Menu principal: Play, Options, orientação de controles, Dicas, Ranking e Histórico.
- Options: duração + intervalo de spawn com validação/persistência; música/SFX; jukebox; cenário de rede apenas em dev.
- Gameplay: arena Pixi, HUD React, pausa, controles desktop e touch.
- Resultado: score, duração efetiva, motivo, resumo de config, estado do registro, Play Again/Main Menu.
- Ranking: nome, score, rank determinístico e paginação para a mesma config.
- History: registros do jogador local com data, score, duração, motivo, config e paginação.
- Partida recebe snapshot clonado da configuração no início.
- Reload/saída durante combate abandona sem registrar.
- Último resultado concluído pode reaparecer após refresh.
- Inglês é a UI padrão da primeira execução; PT/ES são traduções extras ao vivo.

## Configuração tipada

Configurações expostas pelo desafio são sanitizadas em `settings.storage.ts`:

- duração: 60–180 s, passo de 10 s;
- spawn: 1–8 s, passo de 0,5 s.

Constantes base ficam em `DEFAULT_CONFIG`; ajustes arcade ficam em `EXTRA_BALANCE`. Assim o balanceamento não exige reescrever a lógica dos sistemas.

## Arquitetura e ciclo de vida

- Estado contínuo de combate permanece em `GameEngine`; React recebe snapshots limitados.
- Simulação usa delta time com limite de 0,05 s.
- Canvas mantém mundo fixo 1280×720 e escala uniforme.
- Preload executa antes do uso normal do menu e mostra progresso/erro/retry.
- Texturas Pixi tentam até 3 vezes e falhas permanentes geram diagnóstico detalhado no console/HTTP.
- Input/listeners/ticker/`ResizeObserver`/recursos Pixi são limpos no unmount.
- React Strict Mode é suportado pela ownership de create/destroy.
- Touch usa a mesma simulação com perfil visual de performance; as regras não divergem por dispositivo.

## Integridade de ranking/history

- UUID `matchId` estável é criado antes do request.
- UUID local persistente + nome editável identificam o jogador.
- Duração efetiva vem do tempo de simulação e exclui pausa.
- Ranking compara exatamente `sessionTime + enemySpawnTime`.
- Cada `matchId` confirmado é uma entrada individual; não existe colapso por jogador.
- Desempate: score desc → duração asc → timestamp asc → match id.
- Chaves de ranking incluem config/página/cenário; history inclui jogador/página/cenário.
- `AbortSignal` do TanStack Query é repassado ao Axios nos GETs.
- Registro bem-sucedido invalida ranking e history.
- Outbox persistente em array suporta múltiplas pendências.
- Registro MSW é idempotente por `matchId`.
- Pendências sobrevivem ao refresh e são reenviadas depois.
- Pendência nunca bloqueia uma nova partida.

## Cobertura dos cenários MSW

Cenários reproduzíveis implementados:

- sucesso normal;
- listas vazias;
- paginação;
- resposta lenta;
- timeout genérico;
- latência variável determinística;
- respostas fora de ordem;
- falha de conexão;
- HTTP 422;
- HTTP 503;
- falha somente no ranking;
- falha somente no history;
- timeout após o servidor salvar;
- backend indisponível no game over + recuperação posterior.

Os controles ficam disponíveis somente com `?dev=1`/`?e2e=1`. **Restore calm seas** reseta banco/cenário mock, mas preserva a outbox do cliente para demonstrar recuperação.

## Comportamento responsivo/mobile

- Composição desktop fica separada dos overrides exclusivos de touch.
- Menus e painéis de dados mobile/tablet podem rolar em vez de esconder conteúdo obrigatório.
- Gameplay touch usa setas esquerda/avançar/direita + dash dedicado à esquerda e artilharia/barril à direita.
- Pointer capture permite movimento + ataque multitouch.
- Renderer touch usa resolução 1, sem antialias/blur caro, densidade visual reduzida e limite de 50 FPS.
- Arena/HUD autoritativos continuam landscape e as regras de gameplay não mudam.

## Acessibilidade

- Botões/inputs/selects nativos permitem navegação por teclado.
- Foco visível é global.
- Formulários têm labels.
- Pausa usa modal semântico `role="dialog"`.
- Score/tempo/casco aparecem também em resumo `aria-live` limitado.
- Teclas de gameplay só são capturadas com GameScreen montado.
- Controles de idioma/áudio têm labels/titles e estado pressed.

## Status dos testes automatizados

A suíte Playwright atual cobre as categorias funcionais principais e as mecânicas recentes (lock de armas, auto-fire da Pólvora Viva, i-frame do dash, emergency support e splash do barril). As assertions mobile estão alinhadas à UI atual de setas.

Ainda faltam evidências dependentes do ambiente, que não devem ser inventadas na documentação:

1. executar `npm ci` + `npm run check` + `npm run test:e2e` num checkout final com Chromium instalado;
2. commitar baselines Playwright `toHaveScreenshot` para menu, arena estável e resultado — elas ainda não existem;
3. fazer profiling empírico do build otimizado na partida obrigatória de 180 s e em cinco ciclos entrar/jogar/sair;
4. confirmar que a URL publicada corresponde exatamente ao commit final avaliado.

Veja `docs/pt-BR/TESTING.md` e `docs/pt-BR/PERFORMANCE.md` para os procedimentos.
