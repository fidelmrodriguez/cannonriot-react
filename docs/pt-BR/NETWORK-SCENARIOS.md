# Cenários de rede

MSW roda também no build publicado no navegador e armazena registros confirmados de partidas em `localStorage`.

| Cenário | Ranking/histórico | Registrar partida | Objetivo |
| --- | --- | --- | --- |
| Mar calmo | sucesso | sucesso | baseline |
| Listas vazias | vazio | sucesso | UI de estado vazio |
| Múltiplas páginas | dados paginados | sucesso | paginação |
| Rede lenta | 1400 ms | sucesso atrasado | estados de loading |
| Timeout da requisição | excede o timeout Axios de 3500 ms | excede timeout | caminho de timeout genérico |
| Latência variável | ciclo determinístico 120/760/260/1080 ms | igual | variação de timing |
| Respostas fora de ordem | alterna 1150/90 ms | igual | proteção contra resposta obsoleta |
| Falha de conexão | erro de rede | erro de rede | caminho offline |
| HTTP 422 | 422 | 422 | falha HTTP do cliente |
| HTTP 503 | 503 | 503 | falha de servidor |
| Falha no ranking | 503 somente no ranking | sucesso | falha isolada do ranking |
| Falha no histórico | 503 somente no histórico | sucesso | falha isolada do histórico |
| Timeout depois de salvar | GET normal | registro é salvo, resposta ultrapassa timeout Axios | retry idempotente |
| Backend indisponível no game over | GET normal | 503 | outbox persistente + recuperação posterior |

## Fluxo de recuperação

1. A partida termina.
2. O cliente grava o registro na outbox antes do POST.
3. O POST falha/expira.
4. O jogador pode iniciar imediatamente outra partida.
5. O avaliador restaura **Calm seas**.
6. Retornar ao menu dispara outra tentativa de recuperação da outbox.
7. Se o servidor já tiver armazenado o registro, o mesmo `matchId` devolve o registro existente.

## Reset

**Restore calm seas** limpa o banco mock e restaura o cenário normal. A outbox do cliente não é apagada, porque apagá-la destruiria justamente o caso de recuperação que precisa ser demonstrado.
