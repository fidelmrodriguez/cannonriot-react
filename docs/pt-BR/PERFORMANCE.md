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

- Antialias Pixi ligado.
- Resolução do renderer em `min(devicePixelRatio, 2)`.
- Densidade completa de decoração/efeitos procedurais.
- Blur filters usados em profundidade/glow e efeitos selecionados.
- Limite de partículas visuais: 120.

### Perfil do renderer touch/mobile/tablet

Ativado quando `(any-pointer: coarse)` corresponde:

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

Os portraits idle atuais têm 724×543; os portraits de dano, vitória e mecânica têm 640×640. Ainda são maiores que a apresentação típica de ~216 px, mas muito menores que as versões source-sized anteriores. O boot também limita a concorrência de texturas Pixi a 3.

Falhas de asset continuam visíveis/fatais para o boot após três tentativas; logs de diagnóstico ajudam a separar problema HTTP/deploy de falha de decode/runtime no navegador.

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
