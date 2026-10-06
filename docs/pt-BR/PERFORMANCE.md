# Profiling de performance

## Salvaguardas de runtime já implementadas

### Salvaguardas compartilhadas da simulação/runtime

- Mundo autoritativo fixo em 1280×720 escalado por CSS, sem reconstruir coordenadas.
- Delta da simulação limitado a 0,05 s.
- Teto dinâmico de inimigos ativos derivado da pressão da partida (limitado a 9–17).
- Orçamento de partículas visuais com destruição explícita de Graphics temporários.
- Remoção single-hit de projéteis e filtro de entidades mortas.
- Snapshots React do HUD limitados a aproximadamente 80 ms, sem state update por frame.
- Aplicação Pixi, listeners de input/visibility/blur e `ResizeObserver` limpos ao destruir a engine.
- Portraits de reação otimizados para tamanhos mais próximos do uso real, reduzindo download/decode/memória de GPU.

### Perfil do renderer desktop

- Desktops normais mantêm antialias Pixi, `min(devicePixelRatio, 2)`, densidade completa de decoração/efeitos e orçamento de 120 partículas.
- Desktops/notebooks antigos ou limitados são detectados por hints de hardware (`hardwareConcurrency <= 4` ou `deviceMemory <= 4 GB`) e passam automaticamente a usar o mesmo perfil reduzido dos dispositivos touch.

### Perfil do renderer touch/mobile/tablet

Ativado quando `(any-pointer: coarse)` corresponde **ou** quando hardware limitado é detectado:

- resolução do renderer fixa em 1;
- antialias desligado;
- ticker com `maxFPS = 50`;
- `BlurFilter`s Pixi caros ignorados;
- caustics reduzidos 18 → 9;
- reefs decorativos reduzidos 11 → 5;
- wavelets reduzidos 54 → 18;
- ripples reduzidos 24 → 8;
- limite de partículas reduzido 120 → 48;
- menor probabilidade/orçamento de trail de projétil;
- intervalo do wake dobrado de 0,055 s para 0,11 s;
- menos streaks/faíscas do dash e debris de explosão.

Esse perfil altera apenas custo de apresentação. A mesma `GameEngine` continua controlando movimento, IA, timers, spawn, dano, colisões e score.

## Pressão do carregamento de assets

O boot bloqueante agora carrega apenas as texturas pequenas essenciais do gameplay, a cena do menu e os SFX. Portraits de reação e cenas de resultado não bloqueiam mais a entrada no menu/jogo. Em dispositivos capazes, os arquivos dos portraits são aquecidos apenas no cache HTTP do navegador, um por vez (sem decode Pixi/GPU), e o decode acontece sob demanda; hardware/rede limitados pulam esse warmup cosmético. Músicas de batalha/resultado/jukebox passam a ser transmitidas quando necessárias, em vez de virarem blobs em memória durante o boot.

Os três wallpapers grandes de menu/resultado foram convertidos de PNG para WebP, reduzindo o payload combinado de aproximadamente 8,7 MB para cerca de 1,0 MB. Os dois reacts do Kraken também foram reduzidos de 1254×1254 para 640×640, diminuindo bastante custo de download, decode e memória de GPU.

A concorrência do carregamento bloqueante se adapta aos hints de hardware (2 workers em dispositivos limitados e até 3/4 para texturas/áudio nos demais). O trabalho adiado usa um único worker e cede tempo via `requestIdleCallback`/timeouts; o warmup dos portraits não faz decode Pixi, evitando pressão desnecessária de GPU/main thread. Save-Data/2G pula completamente o warmup cosmético; dispositivos com <=4 GB / <=4 cores aquecem apenas os dois portraits de evento do Kraken no cache HTTP e deixam o restante totalmente sob demanda.

Falhas de assets obrigatórios continuam visíveis/fatais após três tentativas; falhas de assets opcionais/adiados não bloqueiam o jogo e podem tentar novamente no primeiro uso real. Os logs continuam ajudando a separar problema HTTP/deploy de falha de decode/runtime no navegador.

## Execução empírica obrigatória

O desafio exige medidas reais em build otimizado. Execute:

```bash
npm ci
npm run build
npm run preview
```

Faça profiling pelo menos da partida obrigatória de três minutos e registre:

```text
Hardware:
SO:
Navegador + versão:
Viewport / DPR:
Perfil de input: desktop ou touch
Duração da sessão: 180s
Intervalo de spawn:
FPS médio:
P95 do intervalo entre frames (ms):
Pico de entidades:
Observações de pico/estabilidade de GPU ou memória:
Notas / limitações:
```

Depois faça cinco ciclos entrar → jogar → sair e registre heap/recursos:

```text
Heap ciclo 1:
Heap ciclo 2:
Heap ciclo 3:
Heap ciclo 4:
Heap ciclo 5:
Crescimento contínuo observado? sim/não
Investigação / observações:
```

Use Performance/Memory do navegador contra o preview de produção. Se performance mobile fizer parte da demonstração, repita em pelo menos um celular/tablet representativo.

## Política de evidência

Nenhum número empírico de FPS/heap é inventado no repositório. Os resultados dependem de hardware, navegador, viewport, DPR e estado térmico. A entrega final deve registrar o ambiente exato e guardar traces/screenshots/relatórios junto do commit avaliado.
