# Testes

## Configuração do Playwright

Playwright executa Chromium em dois projetos:

- Chromium desktop;
- Chromium mobile/touch em landscape.

Falhas preservam traces e screenshots. O reporter HTML grava em `playwright-report/`.

```bash
npm ci
npx playwright install chromium
npm run build
npm run test:e2e
npm run test:e2e:report
```

## Determinismo

`?e2e=1` fixa a seed do gameplay em `1337`. A API exclusiva de teste expõe:

- `getState()`;
- `damagePlayer(amount)`;
- `spawnPickup(kind)`;
- `spawnEnemy(kind, x, y, health?)`;
- `setPlayerPose(x, y, rotation?)`;
- `advanceTime(seconds)`.

Esses hooks preparam/observam estado, mas continuam executando o código real de movimento, combate, colisão, IA e timing.

## Mapa de cobertura do desafio

1. Navegação/validação/persistência de options — E2E de opções.
2. Carregamento de assets/erro/retry — teste de falha de rota no boot/loader.
3. Início de partida/movimento/rotação/limites/ilhas — testes de movimento + setup via pose debug.
4. Frontal/lateral/dano/cooldown/pontuação — contagem de projéteis, direção paralela, cooldown e testes de combate/barril.
5. Chaser/Shooter/intervalo de spawn — testes de IA e sequência determinística de tipos.
6. Timeout/morte/fim congelado/restart — relógio controlado + hook de dano.
7. Pausa/blur/retomada — testes de pausa; input é limpo pela engine.
8. Resultado + persistência após refresh — flag de retomada do resultado.
9. Abandono/navegação repetida/touch — nenhum callback de conclusão no unmount; projeto touch.
10. Ranking/history paginação/loading/vazio/erro — testes dos cenários MSW.
11. Registro/atualização/recuperação depois de refresh — outbox persistente em array + invalidation da mutation.
12. Retry pós-timeout/sem duplicata/respostas fora de ordem — `matchId` estável, handler idempotente, `AbortSignal` repassado ao Axios.

## Regressão visual

A suíte deve conter assertions `toHaveScreenshot` para:

- menu principal;
- arena em estado estável com seed fixa;
- tela de resultado.

Gere/atualize baselines somente depois de aprovar visualmente o render de referência:

```bash
npm run test:e2e:update
```

Os PNGs baseline devem ser commitados depois de gerados no navegador/runtime final. Não atualize snapshots apenas para silenciar uma regressão.

## Isolamento

Cada teste deve resetar `localStorage`/estado mock ou usar um browser context novo. Cenários de rede são selecionados pelo mesmo caminho de UI/`localStorage` usado no build de demonstração.
