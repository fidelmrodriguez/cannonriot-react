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

Texturas Pixi usam concorrência 3 e até três tentativas por textura. Falhas permanentes registram diagnósticos `[Cannon Riot preload]`, incluindo URL resolvida e checagem HTTP `HEAD`, e então propagam para a tela visível de erro/retry do boot. Depois que o preload chega a 100%, a tela de boot continua montada até o jogador pressionar **Subir a bordo**. Esse gesto explícito libera o áudio HTML antes de o React revelar o menu, permitindo iniciar a música do menu imediatamente em vez de depender de outro clique posterior.

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

Teclado e touch mapeiam para o mesmo conjunto de `GameAction`. Desktop usa teclas mantidas; no touch, o registro é de ponteiro para múltiplas ações. Assim, um único toque nas zonas diagonais ativa **avançar + esquerda** ou **avançar + direita**, enquanto ponteiros separados ainda podem combinar direção e ataques. Pointer capture é usado quando disponível, com limpeza por ponteiro em release/cancel/lost capture.

A artilharia normal usa recargas independentes de frontal/lateral e um lock global curto:

- cooldown frontal: 0,38 s por padrão;
- cooldown lateral compartilhado: 1,10 s por padrão;
- lock frontal ↔ lateral: 0,25 s;
- buffer de ação touch rápida: 0,32 s.

Pólvora Viva é a exceção deliberada: ignora a regra normal de troca e dispara automaticamente frontal + as duas laterais até o buff terminar.

## Estado do dash e semântica de dano

Dash é um estado temporizado, e não um teleporte instantâneo. A duração ativa padrão é 0,28 s. O deslocamento usa pequenos passos para manter colisões de arena/ilha autoritativas.

`damageShip()` ignora dano ao jogador somente enquanto `isDashing()` é verdadeiro. Não existe período de graça após `finishDash()`.

Se o dash intercepta um Chaser vivo, o Chaser é destruído, o jogador não toma dano de colisão e o dash pode continuar. Como o dash agora é um ataque explícito do jogador, essa destruição vale um ponto e usa o pool normal de portraits de vitória com o grupo de falas `victoryDash`. Uma colisão normal, sem dash, continua sendo autodestruição sem ponto.

Enquanto **Vento a Favor** está ativo, `dashCooldown` é mantido em zero. A distância continua ampliada pelo vento e todo dash concluído fica disponível imediatamente de novo até o timer do buff terminar.

## Modelo de colisão

As interações são separadas em checagens explícitas:

- navio × limites da arena;
- navio × colliders de ilha;
- navio × navio;
- projétil × ilha;
- projétil × saída da arena;
- projétil do jogador × inimigo vivo;
- projétil inimigo × jogador vivo ou Kraken vivo.
- Kraken × casco de navio; contato de Chaser vira colisão suicida contra o Kraken.
- área do tentáculo do Kraken × jogador/inimigos normais.

A arte das ilhas é irregular/procedural, mas a colisão usa círculos estáveis. Projéteis usam substeps para que tiros acelerados não atravessem colliders pequenos. Um projétil é removido imediatamente após o primeiro hit válido.

Inimigos mortos são ignorados pelos loops de movimento, IA, colisão e projéteis.


### Atrito de casco com Shooter

Shooters roxos continuam sendo navios sólidos, mas contato próximo de casco agora possui regra contínua de atrito. `updateShooterFriction(dt)` detecta o jogador dentro da soma dos raios dos cascos mais uma pequena tolerância e aplica dano baseado em tempo aos dois participantes. O jogador recebe **4,5 HP/s** antes da mitigação da armadura; cada Shooter em contato recebe **26 HP/s**. Isso deixa a raspada disponível como recurso tático de emergência sem transformar ramming na principal fonte de dano.

O dano de atrito suprime spam de portrait/impacto do sistema normal de hits. Em vez disso, um único painel `friction` usa os dois portraits chartreuse dedicados. O painel fica preso enquanto existir qualquer Shooter em contato e só inicia o linger de **2,2 s** depois que o contato termina; um novo contato reinicia esse linger.

## Spawn e IA inimiga

A ordem de tipos segue o padrão determinístico `['chaser', 'shooter']`, garantindo os dois tipos exigidos numa partida normal.

Candidatos de spawn são validados contra limites da arena, ilhas, inimigos ativos e distância mínima do jogador. Se não houver ponto seguro, o spawn é tentado novamente depois em vez de forçar uma posição inválida.

Um inimigo recém-spawnado recebe um telegraph visual curto de `!` preso ao navio. É apenas apresentação: IA, colisão e timing de ataque ficam ativos imediatamente.

Chasers usam perseguição/steering, desvio de ilha e recuperação de stuck. Shooters combinam aproximação/órbita, linha de visão, gerenciamento de alcance e ciclo de mira/disparo.

Um valor determinístico de pressão derivado de `sessionTime` e `enemySpawnTime` ajusta teto de inimigos e pequenos coeficientes de suporte/balanceamento em configurações extremas.

### IA de terceira facção do Kraken

O Kraken é representado por um `KrakenEntity` separado, sem ampliar a union obrigatória `EnemyKind`. Assim o padrão de spawn exigido de Chaser/Shooter permanece intacto, enquanto o Kraken funciona como boss/terceira facção neutro-hostil. `maybeSpawnKraken()` libera o primeiro a partir de 30% da sessão e agenda outro 7–10 s depois de uma derrota quando restarem pelo menos 6 s; não existe caminho de despawn aleatório e o limite ativo é rigidamente um.

`updateKraken(dt)` recalcula a cada tick o alvo vivo mais próximo entre jogador + inimigos normais. O corpo ainda segue esse alvo mais próximo, mas os ataques deixaram de usar uma rajada sincronizada. `KrakenEntity.attackSlots` mantém cinco timers independentes: cada tentáculo pronto escolhe um alvo visível dentro de 210 px, registra o ponto de impacto, telegrafa por cerca de 0,40 s, resolve sozinho e recebe um cooldown próprio com seed entre 0,82–1,28 s. Cooldowns por alvo de 0,55–0,85 s impedem que todos os braços livres caiam exatamente ao mesmo tempo sobre a mesma vítima, sem impedir que jogador e vários inimigos sejam atacados em paralelo e fora de ritmo. A navegação usa grid de água A* leve, checagem com o collider inteiro, suavização de caminho e recálculo ao detectar stuck. O alvo dos inimigos normais passa por `enemyTarget(enemy)`: proximidade só torna o Kraken elegível quando ele é a ameaça local mais atraente, com 80 px de histerese; se um tentáculo causar dano num inimigo, ele retalia contra o Kraken por 5 s. Tiros inimigos causam 55% do dano normal contra o boss e rams de Chaser causam 24 de dano; essas kills nunca pontuam para o jogador.

O Kraken consome três slots no cálculo do teto de spawn normal, enquanto o HUD conta seu corpo visível como uma entidade inimiga. A arte base continua sendo um sprite estático, mas em runtime recebe quatro tentáculos procedurais leves, anéis de água animados e um squash/stretch sutil; o antigo sobe-e-desce vertical foi removido para ele não parecer voando sobre a água. Projéteis do jogador e dano do barril podem finalizá-lo; somente um golpe final causado pelo jogador concede +1. Contato de casco entre jogador e Kraken reutiliza os portraits de atrito com falas específicas da criatura. O feedback de dano do Kraken evita deterioração com fogo de navio, e `destroyKraken()` agora reutiliza a explosão normal em vez de uma sequência própria de afundamento/deformação.

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
