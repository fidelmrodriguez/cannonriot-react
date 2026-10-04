# Cenários de rede

MSW roda em desenvolvimento, preview, E2E e no build publicado no navegador. Registros confirmados do mock ficam em `localStorage`; envios pendentes do cliente ficam numa outbox persistente separada.

O seletor de cenário fica escondido do jogador normal. Abra o app com `?dev=1` (ou `?e2e=1` nos testes) e use **Options → Network Scenario**.

Axios usa timeout de 3500 ms. A latência normal simulada é de aproximadamente 140 ms.

| Cenário | Ranking/history | Registro de partida | Objetivo |
| --- | --- | --- | --- |
| `normal` | sucesso | sucesso | baseline |
| `empty` | listas vazias | sucesso | estado vazio |
| `pagination` | dados paginados | sucesso | paginação |
| `slow` | ~1400 ms | sucesso atrasado | estados de loading |
| `timeout` | ~4200 ms / timeout Axios | ~4200 ms / timeout Axios | timeout genérico sem mutar servidor |
| `variable-latency` | ciclo determinístico 120/760/260/1080 ms | igual | variação de timing |
| `out-of-order` | alterna 1150/90 ms | igual | proteção contra resposta obsoleta |
| `network-error` | erro de conexão | erro de conexão | caminho offline/rede |
| `client-error` | HTTP 422 | HTTP 422 | erro HTTP de cliente |
| `server-error` | HTTP 503 | HTTP 503 | erro HTTP de servidor |
| `ranking-error` | somente ranking GET 503 | sucesso | falha isolada de ranking |
| `history-error` | somente history GET 503 | sucesso | falha isolada de history |
| `timeout-after-save` | GETs normais | registro é salvo e resposta espera ~5 s | retry idempotente após resultado desconhecido |
| `unavailable-on-game-over` | GETs normais | HTTP 503 | outbox persistente + recuperação |

## Comportamento das queries

Chaves de ranking incluem duração, intervalo de spawn, página e cenário de rede selecionado. Chaves de history incluem player id local, página e cenário. GETs repassam o `AbortSignal` do TanStack Query ao Axios, e registro bem-sucedido invalida ranking/history.

Queries normais permitem um retry do TanStack Query; cenários de falha desabilitam esse retry automático para a falha escolhida permanecer determinística e visível.

## Fluxo de recuperação

1. Uma partida concluída recebe `matchId` estável.
2. O cliente grava o registro na outbox antes do POST.
3. O POST tem sucesso, falha ou expira.
4. Em sucesso, somente aquele `matchId` sai da outbox.
5. Em falha/timeout, o registro permanece pendente e o jogador pode iniciar outra partida.
6. Pendências são reenviadas no bootstrap e ao retornar ao menu.
7. Se o mock já tiver salvo o registro (por exemplo em `timeout-after-save`), reenviar o mesmo `matchId` devolve o registro existente em vez de duplicar.

## Reset

**Restore calm seas** restaura o cenário `normal`, limpa o banco mock de registros confirmados e zera o contador de sequência das requests simuladas.

A outbox do cliente **não** é apagada de propósito. Isso permite demonstrar o caso “backend indisponível → restaurar rede → recuperar partida pendente”.
