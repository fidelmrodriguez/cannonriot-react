# Testes

## Configuração do Playwright

Playwright executa o mesmo build de produção em dois projetos Chromium:

- `desktop-chromium` — perfil Desktop Chrome;
- `mobile-chromium` — perfil Pixel 7, viewport `915×412`, touch ligado e landscape.

O web server usa `npm run build && npm run preview`. Falhas preservam traces e screenshots; o relatório HTML vai para `playwright-report/`.

```bash
npm ci
npx playwright install chromium
npm run test:e2e
npm run test:e2e:report
```

## Determinismo e API de teste

Abrir com `?e2e=1` fixa a seed do gameplay em `1337` e expõe `window.__CANNON_RIOT_TEST__` somente enquanto GameScreen está montado.

Helpers disponíveis:

- `getState()`;
- `damagePlayer(amount)`;
- `spawnPickup(kind)`;
- `spawnEnemy(kind, x, y, health?)`;
- `setEnemyShootCooldown(id, seconds)`;
- `setPlayerPose(x, y, rotation?)`;
- `advanceTime(seconds)`;
- `setTimeRemaining(seconds)`.

`advanceTime()` chama o tick real da engine em passos fixos de 1/30 s. Os helpers preparam/observam estado; não substituem colisão, dano, IA, armas ou pontuação.

## Cobertura automatizada atual

`tests/e2e/app.spec.ts` cobre atualmente:

1. falha de asset no boot e recuperação por retry visível;
2. inglês padrão + troca EN/PT/ES ao vivo durante partida;
3. identidade local persistente;
4. validação/persistência de options;
5. controles desktop e D-pad/artilharia touch, incluindo direção diagonal avançar + esquerda/direita com um único polegar e combinações multitouch;
6. controles/HUD touch dentro da viewport landscape;
7. limites de movimento e colisão com ilha;
8. rotação e ataque à distância do Shooter;
9. contagem/direção dos tiros frontal/lateral, cooldowns e lock de troca de arma de 0,25 s;
10. kill por projétil pontuando uma vez;
11. sequência normal de spawn contendo Chaser e Shooter;
12. contato sólido e sem dano com casco do Shooter;
13. dano de colisão + autodestruição sem ponto do Chaser;
14. Pólvora Viva disparando frontal + duas laterais automaticamente e parando ao expirar;
15. i-frame ativo do dash, counter de Chaser e vulnerabilidade imediata após o dash;
16. emergency drop de Medicina/Armadura com casco ≤35% e cooldown;
17. cura de Medicina e timers de buff parados na pausa;
18. pausa por blur exigindo retomada explícita sem avanço de tempo;
19. kill do gatilho do barril, splash ampliado não letal e imunidade do jogador ao próprio barril;
20. persistência do resultado por timeout e restart limpo;
21. resultado correto por morte do jogador;
22. abandono sem criar registro no DB/outbox;
23. navegação/remount repetidos mantendo um único canvas;
24. registro bem-sucedido aparecendo em ranking e histórico local;
25. estados vazio, timeout/erro e paginação de ranking/history;
26. retry idempotente após timeout-after-save;
27. persistência/recuperação da outbox quando o backend está indisponível no game over;
28. requests fora de ordem mantendo a página de ranking selecionada.

Os seletores mobile apontam para o D-pad atual; a suíte não espera mais o joystick virtual removido e inclui regressão para direção diagonal com um único polegar.

## Isolamento de rede e estado

Os testes abrem com `?e2e=1`, que também expõe a UI de cenários de rede. Fixtures/estado MSW vivem no `localStorage` do navegador. Ao adicionar casos, prefira um browser context novo ou limpe as chaves relevantes para evitar acoplamento entre testes.

## Status da regressão visual

O desafio exige baselines versionadas do menu, arena estável e resultado. O arquivo Playwright atual **ainda não** contém baselines `toHaveScreenshot` commitadas.

Antes da submissão final, adicione/aprove essas baselines usando o navegador/runtime final, sem atualizar snapshots apenas para silenciar regressões:

```bash
npm run test:e2e:update
```

## Checklist de verificação final

Num checkout limpo com Node 22 e Chromium do Playwright instalados:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Guarde o relatório HTML e traces/screenshots de falhas. Evidência empírica de performance fica em `docs/pt-BR/PERFORMANCE.md`.
