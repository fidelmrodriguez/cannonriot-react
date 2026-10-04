# Arquitetura

## Visão geral

Cannon Riot separa interface da aplicação, dados persistentes/remotos e combate em tempo real.

- **React** controla navegação, menus/formulários, options, resultado, HUD semântico, controles de áudio/idioma, jukebox e painéis de ranking/history.
- **PixiJS** controla a arena em tempo real: navios, ilhas, projéteis, barras de vida, decoração procedural da água e efeitos de combate.
- **GameEngine** é o orquestrador autoritativo da partida. Estado contínuo de combate fica fora do React.
- **InputManager** controla o estado de ações de teclado/touch.
- **TanStack Query + Axios** controlam ranking/history e registro de partida.
- **MSW** implementa a simulação REST em desenvolvimento, preview, E2E e build publicado.
- **localStorage** persiste opções, preferências de idioma/áudio, identidade do jogador, registros confirmados do mock, último resultado concluído, cenário de rede de demonstração e outbox de partidas pendentes.

O mundo autoritativo do gameplay é sempre 1280×720; DOM/canvas apenas escalam ao redor dele.

## Ciclo de vida React/PixiJS

`GameScreen` cria uma `GameEngine` por partida. No unmount, a engine destrói a aplicação Pixi e limpa listeners/recursos. O desenho é compatível com o ciclo mount → destroy → mount do React Strict Mode.

React recebe um snapshot limitado aproximadamente a cada 80 ms para o HUD. O ticker Pixi continua autoritativo para movimento, IA, cooldowns, projéteis, buffs e efeitos.

O cleanup inclui:

- callback principal do ticker;
- callbacks temporários dos painéis/efeitos por meio da destruição da árvore;
- listeners de input de teclado;
- listeners de blur/visibility;
- `ResizeObserver`;
- árvore de display/aplicação Pixi;
- referências de áudio em runtime.

Sair do combate antes de um evento de conclusão apenas destrói a engine; nenhum registro de partida é criado.

## Boot e preload de assets

`preloadAllAssets()` executa antes do uso normal do menu. Ele inicia o worker do MSW e pré-carrega:

1. texturas de gameplay/reação via Pixi `Assets`;
2. wallpapers de menu/resultado via `Image` do DOM;
3. SFX via `fetch` + object URLs;
4. músicas pelo mesmo caminho de áudio.

Texturas Pixi usam concorrência 3 e até três tentativas por textura. Falhas permanentes registram diagnósticos `[Cannon Riot preload]`, incluindo URL resolvida e checagem HTTP `HEAD`, e então propagam para a tela visível de erro/retry do boot.

O loader mantém as URLs originais e não adiciona query strings de cache-busting.

## Snapshot da configuração de partida

Options persiste um `GameConfig` sanitizado. `GameScreen` faz `structuredClone` antes de construir a engine, então uma partida em andamento não observa alterações posteriores.

A chave de comparação do ranking usa apenas:

```ts
{
  sessionTime,
  enemySpawnTime,
}
```

Os demais valores são constantes versionadas de código/balanceamento, e não dimensões de leaderboard controladas pelo jogador.

## Modelo de tempo

`deltaMS` do ticker é convertido para segundos e limitado a no máximo 0,05 s por update. Movimento, IA, cooldowns, lifetime de projétil, buffs, timers de suporte, spawn e duração usam tempo de simulação.

Ticks pausados não avançam `elapsed`, então a duração salva não inclui tempo em pausa.

Em E2E, `?e2e=1` fixa a seed em `1337` e expõe `advanceTime(seconds)`, que avança o mesmo caminho da simulação em passos fixos.

## Modelo de input

Teclado e touch mapeiam para o mesmo conjunto de `GameAction`. Desktop usa teclas mantidas; os controles touch mantêm um registro independente de ponteiro por ação, então **avançar + esquerda/direita** podem permanecer ativos ao mesmo tempo e o movimento pode coexistir com ataques. Pointer capture é usado quando disponível, com limpeza por ponteiro em release/cancel/lost capture.

A artilharia normal usa recargas independentes de frontal/lateral e um lock global curto:

- cooldown frontal: 0,38 s por padrão;
- cooldown lateral compartilhado: 1,10 s por padrão;
- lock frontal ↔ lateral: 0,25 s;
- buffer de ação touch rápida: 0,32 s.

Pólvora Viva é a exceção deliberada: ignora a regra normal de troca e dispara automaticamente frontal + as duas laterais até o buff terminar.

## Estado do dash e semântica de dano

Dash é um estado temporizado, e não um teleporte instantâneo. A duração ativa padrão é 0,28 s. O deslocamento usa pequenos passos para manter colisões de arena/ilha autoritativas.

`damageShip()` ignora dano ao jogador somente enquanto `isDashing()` é verdadeiro. Não existe período de graça após `finishDash()`.

Se o dash intercepta um Chaser vivo, o Chaser se autodestrói, o jogador não toma dano de colisão e o dash pode continuar. O evento continua sem pontuar para preservar a regra do desafio sobre autodestruição do Chaser.

## Modelo de colisão

As interações são separadas em checagens explícitas:

- navio × limites da arena;
- navio × colliders de ilha;
- navio × navio;
- projétil × ilha;
- projétil × saída da arena;
- projétil do jogador × inimigo vivo;
- projétil inimigo × jogador vivo.

A arte das ilhas é irregular/procedural, mas a colisão usa círculos estáveis. Projéteis usam substeps para que tiros acelerados não atravessem colliders pequenos. Um projétil é removido imediatamente após o primeiro hit válido.

Inimigos mortos são ignorados pelos loops de movimento, IA, colisão e projéteis.

## Spawn e IA inimiga

A ordem de tipos segue o padrão determinístico `['chaser', 'shooter']`, garantindo os dois tipos exigidos numa partida normal.

Candidatos de spawn são validados contra limites da arena, ilhas, inimigos ativos e distância mínima do jogador. Se não houver ponto seguro, o spawn é tentado novamente depois em vez de forçar uma posição inválida.

Um inimigo recém-spawnado recebe um telegraph visual curto de `!` preso ao navio. É apenas apresentação: IA, colisão e timing de ataque ficam ativos imediatamente.

Chasers usam perseguição/steering, desvio de ilha e recuperação de stuck. Shooters combinam aproximação/órbita, linha de visão, gerenciamento de alcance e ciclo de mira/disparo.

Um valor determinístico de pressão derivado de `sessionTime` e `enemySpawnTime` ajusta teto de inimigos e pequenos coeficientes de suporte/balanceamento em configurações extremas.

## Pickups e diretor de suporte

Existem quatro pickups: Medicina, Pólvora Viva, Vento a Favor e Casco Reforçado. Drops normais usam pressão, estado do casco e buffs ativos para escolher suporte útil.

Com ≤35% de casco, `maybeSpawnEmergencyDrop()` procura Medicina/Armadura próxima. Se não houver e o cooldown de emergência de 12 s estiver pronto, tenta posicionar uma caixa defensiva a 105–180 px do jogador. Quando o limite normal de pickups já está cheio, pode substituir uma caixa menos útil/mais distante para a emergência não ser bloqueada silenciosamente.

Buffs repetidos estendem a duração com limite, em vez de resetar sem teto.

## Barril de pólvora

O jogador pode manter até três barris ativos. Um barril arma após 0,48 s, dura 10,5 s e dispara quando um inimigo entra no raio de gatilho.

O inimigo que aciona é uma kill garantida e pontuável. Outros inimigos dentro do raio de explosão de 170 px recebem dano com falloff limitado para nunca finalizá-los; ficam com no mínimo 1 HP. A explosão do próprio barril nunca causa dano ao jogador.

Isso mantém a armadilha útil contra grupos densos sem transformar um barril em chain-kill automático.

## Painéis de reação e ownership de áudio

Painéis de dano, vitória, idle e mecânicas são overlays Pixi. O posicionamento evita a zona de segurança do jogador e tenta evitar sobreposição entre painéis ativos.

Painéis idle são o único caminho que reproduz `idle_captain_chirp.wav`. Dash/pickups/barril não reutilizam esse chirp. A destruição do jogador controla o próprio som de explosão para que um tiro fatal produza hit + explosão final; colisão de Chaser evita duplicar o mesmo evento sonoro.

## Semântica de pausa

Pausa manual e pausa automática por blur/aba oculta usam o mesmo caminho. Pausar desabilita/limpa input e define o ticker como zero. Recuperar foco nunca retoma sozinho; o jogador precisa agir explicitamente.

## Identidade e persistência do jogador

O app cria um UUID local e um display name editável de até 24 caracteres. Partidas concluídas capturam os dois. History é consultado pelo UUID; ranking mostra o nome capturado.

Opções de gameplay são sanitizadas ao carregar/salvar. O último resultado concluído é persistido separadamente da flag que decide se a tela de resultado deve reaparecer após refresh.

## Registro de partida e outbox

Um `matchId` estável é criado antes de qualquer request. `useRegisterMatch()` coloca o resultado na outbox antes do POST; sucesso remove somente esse id.

A outbox é `MatchResult[]`, permitindo múltiplas pendências. Ela sobrevive ao refresh e é reenviada no bootstrap e ao retornar ao menu.

O MSW persiste registros confirmados num banco mock separado e trata `matchId` como idempotente. Assim, “servidor salvou mas a resposta expirou” recupera sem duplicação.

## Consistência das queries de ranking/history

Chaves de ranking incluem duração, intervalo de spawn, página e cenário de rede atual. Chaves de history incluem player id, página e cenário.

GETs recebem o `AbortSignal` do TanStack Query e repassam ao Axios. Registro bem-sucedido invalida ranking e history. `keepPreviousData` estabiliza transições de paginação enquanto a nova página carrega.

## Renderização responsiva e performance touch

Coordenadas do mundo e regras nunca mudam conforme a viewport. O canvas é escalado uniformemente por CSS para caber no espaço disponível.

Desktop:

- antialias ligado;
- resolução limitada ao DPR 2;
- densidade completa de decoração/efeitos.

Perfil touch/coarse-pointer:

- resolução do renderer fixada em 1;
- antialias Pixi desligado;
- ticker limitado a 50 FPS;
- `BlurFilter`s caros ignorados;
- menos caustics, reefs, wavelets e ripples;
- limite de partículas visuais reduzido de 120 para 48;
- menor probabilidade/orçamento de trail de projétil, frequência de wake e debris de explosão.

Essas mudanças são apenas de apresentação/performance. IA, dano, colisão, timers, spawn e score são idênticos.

## Internacionalização

Inglês é o idioma padrão da primeira execução. Português e espanhol são alternativas ao vivo. A UI React muda imediatamente; a engine continua montada. Novos labels/reactions Pixi consultam o idioma global atual quando são emitidos.
