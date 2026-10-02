# Profiling de performance

## Salvaguardas de runtime já implementadas

- DPR limitado a 2;
- mundo fixo em 1280×720 e escalado por CSS, sem reconstruir coordenadas do mundo;
- delta da simulação limitado;
- teto de inimigos ativos em configurações agressivas de spawn;
- orçamento de partículas para faíscas de projéteis;
- texturas Pixi pré-carregadas/reutilizadas;
- callbacks temporários de ticker se removem ao terminar;
- snapshots React limitados, em vez de state update por frame;
- engine/listeners/`ResizeObserver` destruídos no unmount.

## Execução empírica obrigatória

O desafio exige medições reais num build otimizado. Execute:

```bash
npm ci
npm run build
npm run preview
```

Registre os itens abaixo para uma partida de 180 segundos:

```text
Hardware:
SO:
Navegador + versão:
Viewport / DPR:
Duração da sessão: 180s
Intervalo de spawn:
FPS médio:
P95 do intervalo entre frames (ms):
Pico de entidades:
Observações:
```

Depois faça cinco ciclos completos entrar → jogar → sair e registre comportamento de heap/recursos:

```text
Heap ciclo 1:
Heap ciclo 2:
Heap ciclo 3:
Heap ciclo 4:
Heap ciclo 5:
Crescimento contínuo observado? sim/não
Investigação/observações:
```

Use as ferramentas Performance/Memory do navegador no preview de produção. Antes da submissão final, armazene screenshots/traces exportados em `reports/`.

## Por que não existem números inventados no repositório

Valores de performance dependem de hardware, navegador, viewport e runtime. O repositório documenta o procedimento exato e as salvaguardas de código; números empíricos devem ser capturados no ambiente real da submissão final, e não fabricados.
