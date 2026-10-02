# Arquitetura

## Visão geral

Cannon Riot separa responsabilidades de interface da aplicação, dados persistentes/remotos e combate em tempo real.

- **React** controla navegação, menus/formulários, estado da tela de resultado, HUD semântico, controles de áudio/idioma, opções e painéis de dados remotos.
- **PixiJS** controla a arena de combate visível, navios, projéteis, obstáculos, barras de vida e efeitos em tempo real.
- **GameEngine** é o orquestrador da partida. Estado contínuo de combate permanece nele e nunca vive em estado React frame a frame.
- **InputManager** controla estado de ações de teclado/touch.
- **TanStack Query + Axios** controlam requests remotos de ranking/histórico.
- **MSW** fornece a simulação REST em desenvolvimento, preview, testes e build publicado.
- **localStorage** persiste configurações, preferências de idioma/áudio, identidade do jogador local, registros confirmados do mock, último resultado concluído e outbox de partidas pendentes.

## Ciclo de vida React/PixiJS

`GameScreen` cria uma única `GameEngine` para uma partida. A engine é destruída no unmount. Assim, o React Strict Mode exercita mount → destroy → mount sem manter intencionalmente aplicações Pixi ou listeners duplicados vivos.

A engine envia um snapshot limitado ao React aproximadamente a cada 80 ms. O ticker Pixi continua sendo a fonte de verdade para movimento contínuo, projéteis, IA, cooldowns e efeitos de combate.

O cleanup inclui:

- remover o callback principal do ticker;
- remover callbacks ativos dos painéis cômicos;
- desanexar listeners de teclado;
- remover listeners de blur/visibility;
- desconectar o `ResizeObserver`;
- destruir a aplicação Pixi/árvore de containers;
- limpar referências de áudio.

## Snapshot da configuração de partida

Options persiste uma configuração tipada e sanitizada. `GameScreen` faz um `structuredClone` antes de construir `GameEngine`. Assim, uma partida em andamento não observa alterações posteriores nas configurações.

A chave editável do leaderboard é intencionalmente:

```ts
{
  sessionTime,
  enemySpawnTime,
}
```

Todos os demais parâmetros de gameplay são parâmetros versionados de código/balanceamento, e não dimensões de leaderboard controladas pelo usuário.

## Modelo de tempo

`deltaMS` do ticker Pixi é convertido para segundos e limitado antes das atualizações da simulação. Movimento, rotação, IA, cooldowns, lifetime de projétil, duração de buff, cadência de spawn e duração da partida usam tempo decorrido da simulação.

A duração salva ao final vem do relógio da simulação. Tempo pausado não entra na duração porque ticks pausados não avançam `elapsed`.

Para E2E, `?e2e=1` fixa a seed e expõe um hook exclusivo de teste `advanceTime(seconds)` que avança o mesmo caminho de atualização da simulação em passos fixos.

## Semântica de pausa

Pausa manual e pausa automática por blur/aba oculta usam o mesmo caminho. Pausar desabilita e limpa input e define velocidade do ticker como zero. Recuperar foco não retoma automaticamente. O jogador precisa retomar explicitamente, evitando que inputs mantidos/disparados durante a perda de foco sejam acumulados.

## Modelo de colisão

A arena autoritativa é 1280×720. O movimento de navios é limitado à arena visível. As ilhas têm visuais procedurais irregulares, enquanto a colisão usa múltiplos círculos por ilha.

Interações são separadas:

- navio × limites da arena;
- navio × ilha;
- navio × navio;
- projétil × ilha;
- projétil × limites da arena;
- projétil do jogador × inimigo vivo;
- projétil inimigo × jogador vivo.

Projéteis usam substeps para que disparos acelerados não atravessem colliders pequenos. Um projétil é marcado inativo/removido imediatamente depois do primeiro hit válido.

Inimigos mortos são ignorados por movimento, IA, colisão e loops de projétil. Colisão do Chaser chama a destruição com `awardPoint = false`; kills por projétil/ataque do jogador chamam com `true`.

## Spawn e IA inimiga

Tipos de inimigo são distribuídos de forma determinística por sequência para garantir Chaser e Shooter em uma partida normal. Candidatos de spawn são gerados nas bordas da arena e validados contra:

- distância mínima do jogador;
- colisão com ilha;
- espaçamento de inimigos ativos;
- limites da arena.

Se não existir posição válida, o spawn é tentado novamente depois em vez de cair para uma posição inválida.

A IA usa steering, look-ahead de ilhas, linha de visão para Shooters, separação e recuperação de estado preso. Um teto dinâmico de inimigos ativos protege justiça e performance na configuração de spawn a cada 1 segundo.

## Identidade local do jogador

Autenticação está fora do escopo do desafio, mas identificação do jogador é obrigatória. O app cria um UUID persistente e um nome local editável. Ambos são capturados em todo registro de partida concluída, e as queries do histórico usam o UUID.

## Registro de partida e outbox

Partidas concluídas são representadas por um UUID `matchId` estável antes de qualquer chamada de rede. O cliente grava a partida numa outbox persistente antes do POST.

A outbox é `MatchResult[]`, não um único slot pendente. Isso permite:

```text
Partida A -> pendente
Partida B -> confirmada
Partida C -> pendente
```

sem bloquear uma nova partida.

No sucesso, apenas o `matchId` correspondente é removido. Em falha/timeout, ele permanece. O app tenta reenviar registros pendentes no bootstrap e novamente ao retornar ao menu.

MSW armazena registros confirmados por `matchId` e devolve um registro já existente em retries duplicados. Isso fornece idempotência ao caso “salvo no servidor, resposta expirou, cliente tenta novamente”.

## Consistência das queries de ranking/histórico

As query keys de ranking incluem duração, intervalo de spawn e página. As de histórico incluem `playerId` e página. TanStack Query é responsável por cache e invalidação.

As funções de query recebem o `AbortSignal` do TanStack Query e o repassam ao Axios. Requests obsoletos podem ser cancelados em vez de disputar atualização manual de estado no componente. O cenário MSW de respostas fora de ordem aplica delays alternados de propósito para exercitar esse comportamento.

Cada `matchId` confirmado permanece como uma entrada individual do ranking, ordenada por critérios determinísticos.

## Persistência de resultado vs partidas abandonadas

Um resultado concluído é persistido localmente e marcado como retomável para que um refresh na tela de resultado restaure essa tela. Escolher Main Menu ou Play Again remove apenas o marcador “retomar tela de resultado”, não o registro do último resultado.

Sair/recarregar durante combate apenas destrói a engine da partida. Como nenhum callback de conclusão é executado, partidas abandonadas nunca entram na outbox, ranking ou histórico.

## Renderização responsiva

As coordenadas do mundo nunca mudam com o tamanho da viewport. O canvas Pixi é escalado uniformemente para caber no espaço disponível. DPR é limitado a 2. Mobile/tablet usa a mesma simulação e dimensões de mundo com overlay touch e shell landscape-first.

## Internacionalização

Inglês é o padrão da primeira execução. O estado de idioma é global e a engine Pixi consulta o idioma atual ao criar novos labels/reacts. Trocar idioma durante combate altera a UI React imediatamente sem remontar `GameEngine`; novos textos emitidos pelo Pixi usam o novo idioma.
