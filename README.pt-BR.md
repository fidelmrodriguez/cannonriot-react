# Cannon Riot

Cannon Riot é um shooter naval 2D top-down criado para o desafio técnico **React & PixiJS — Pirate Battle**. O React controla a interface da aplicação e as telas de dados remotos; o PixiJS controla a arena de combate em tempo real. O projeto usa TypeScript strict, Axios + TanStack Query para dados REST, MSW para a simulação de API no navegador e Playwright para E2E.

> Documentação padrão em inglês: [README.md](README.md)

## Build público

https://cannonriot-react.netlify.app/

## Executar localmente

Requisitos:

- Node.js 22 (`.nvmrc` e `package.json` apontam para Node 22)
- npm

```bash
npm ci
npm run dev
```

Não existem variáveis de ambiente obrigatórias. Ranking e histórico são simulados no navegador pelo MSW em desenvolvimento, preview, testes e build publicado.

## Comandos

```bash
npm run dev              # servidor Vite de desenvolvimento
npm run build            # projetos TypeScript strict + build Vite de produção
npm run preview          # preview do build de produção
npm run lint             # checagens de higiene do repositório
npm run typecheck        # verificação TypeScript strict
npm run test:e2e         # suíte Playwright Chromium
npm run test:e2e:ui      # modo UI do Playwright
npm run test:e2e:update  # atualiza baselines visuais intencionalmente
npm run test:e2e:report  # abre relatório HTML
npm run check            # lint + typecheck + build
```

Quando necessário, instale o Chromium do Playwright uma vez:

```bash
npx playwright install chromium
```

## Controles

### Teclado

| Ação | Controle |
| --- | --- |
| Avançar | `W` / `Arrow Up` |
| Girar esquerda/direita | `A` / `D` ou setas |
| Canhão frontal | `Space` |
| Salva lateral esquerda/direita | `Q` / `E` |
| Dash | `Ctrl` |
| Barril de pólvora | `R` |
| Pausar/retomar | `P` / `Esc` |

### Touch/mobile/tablet

Dispositivos touch usam botões de navegação mantidos à esquerda — **girar à esquerda, avançar, girar à direita** — mais um botão dedicado de dash. Os controles de canhão frontal/laterais e barril de pólvora ficam à direita. Cada toque é rastreado de forma independente, então é possível segurar **avançar + esquerda** ou **avançar + direita** ao mesmo tempo; movimento e ataques também podem permanecer pressionados juntos via multitouch.

O gameplay prioriza landscape. Breakpoints touch também ativam um perfil de performance móvel sem alterar as regras da simulação.

## Regras de gameplay

O mundo autoritativo é uma arena fixa de **1280×720**. Redimensionar a viewport altera apenas a escala de apresentação.

- O jogador avança e gira para esquerda/direita.
- O canhão frontal dispara um projétil.
- Cada lateral dispara três projéteis paralelos.
- No modo normal, frontal e lateral são separados por um **lock global de troca de arma de 0,25 s**; taps touch rápidos podem ficar em buffer por **0,32 s**.
- Chasers perseguem o jogador e se autodestroem ao colidir com ele. Essa colisão não pontua.
- Shooters buscam posição de ataque, linha de visão e disparam à distância.
- Ilhas e limites da arena bloqueiam navios; ilhas também bloqueiam projéteis.
- Projéteis aplicam dano uma única vez e são removidos ao acertar, encontrar obstáculo, expirar ou sair da arena.
- Cada inimigo destruído por um ataque pontuável do jogador vale exatamente um ponto.
- A partida termina quando o tempo ativo acaba ou o casco do jogador chega a zero.
- Pausa manual, blur da janela e aba oculta suspendem simulação/cooldowns. A retomada exige ação explícita do jogador.
- Reiniciar cria uma engine limpa e novo match id/seed.

Configuração padrão: partida de **120 s** e spawn de inimigo a cada **3 s**. Options expõe os intervalos do desafio: **60–180 s** e **1–8 s**.

## Mecânicas arcade e balanceamento de alta pressão

As regras exigidas pelo desafio continuam autoritativas; estas mecânicas são adicionais:

- **Dash**: estado de movimento ativo por 0,28 s. O jogador fica imune a projéteis e dano de contato somente durante esse estado. Se atingir um Chaser durante o dash, o Chaser se autodestrói sem ferir o jogador e continua sem pontuar. Não existe invulnerabilidade depois do dash.
- **Pólvora Viva**: artilharia automática temporária. Frontal + as duas laterais disparam assim que suas recargas aceleradas ficam prontas, até o buff acabar.
- **Vento a Favor**: aumenta velocidade de movimento e melhora distância/cooldown do dash.
- **Casco Reforçado**: reduz temporariamente o dano recebido.
- **Medicina**: recupera casco.
- **Barril de Pólvora**: até três armadilhas ativas; o navio que aciona é destruído e navios próximos dentro do raio de **170 px** recebem dano forte, porém não letal. O jogador é imune à própria explosão.
- **Suporte de emergência**: com ≤35% de casco, se não houver Medicina/Armadura próxima, o jogo tenta colocar um pickup defensivo perto do jogador. Há cooldown de 12 s e o sistema pode substituir um pickup ativo menos útil se os slots normais estiverem cheios.
- **Alerta de spawn**: o `!` curto é apenas visual; inimigos recém-spawnados continuam ativos imediatamente.

A assistência de dificuldade é derivada de forma determinística pela duração e intervalo de spawn escolhidos. Ela altera cadência de suporte, teto de inimigos e pequenos coeficientes, mas nunca muda a chave do ranking nem o valor do ponto.

Veja [docs/pt-BR/GAMEPLAY-BALANCE.md](docs/pt-BR/GAMEPLAY-BALANCE.md).

## Identidade do jogador e registros

Autenticação está fora do escopo. O Cannon Riot cria um `playerId` local persistente e expõe um nome editável (máximo de 24 caracteres) no menu. Partidas concluídas capturam os dois valores.

Um registro concluído contém UUID `matchId`, identidade do jogador, data, score, duração efetiva da simulação, motivo de encerramento, snapshot completo da configuração e seed.

## Comparabilidade do ranking

A chave do ranking usa apenas os dois parâmetros editáveis pelo jogador:

```ts
{
  sessionTime,
  enemySpawnTime,
}
```

Assim, uma partida 120 s / 3 s não compete diretamente com uma 180 s / 1 s. A ordenação é score decrescente, duração crescente, data crescente e por fim match id.

## Registro, idempotência e recuperação

Antes do POST, uma partida concluída entra numa **outbox** local persistente. A outbox é um array, então uma falha não bloqueia partidas seguintes.

O MSW armazena registros confirmados por `matchId`; reenviar o mesmo id devolve o registro existente em vez de duplicar. Pendências sobrevivem ao refresh e são reenviadas no bootstrap e ao retornar ao menu. Partidas abandonadas nunca são registradas.

## TanStack Query, Axios e MSW

- Chave de ranking: configuração + página + cenário de rede atual.
- Chave de histórico: `playerId` local + página + cenário de rede atual.
- Timeout Axios: 3500 ms.
- O `AbortSignal` do TanStack Query é repassado ao Axios nos GETs de ranking/history.
- Registro bem-sucedido invalida ranking e history.
- Registros confirmados do mock ficam persistidos em `localStorage`.

Os cenários de rede ficam escondidos no uso normal. Abra com `?dev=1` (ou `?e2e=1`) e use **Options → Network Scenario**. Veja [docs/pt-BR/NETWORK-SCENARIOS.md](docs/pt-BR/NETWORK-SCENARIOS.md).

## Carregamento de assets e diagnóstico

O preloader global inicia o MSW e depois carrega texturas Pixi, wallpapers de tela, SFX e músicas antes do uso normal do menu. Texturas Pixi têm no máximo **3 tentativas** e concorrência limitada. Uma falha definitiva de textura/áudio/imagem é registrada com o prefixo `[Cannon Riot preload]` e um diagnóstico HTTP `HEAD` antes da tela de erro/retry do boot.

Áudios são baixados para object URLs e reutilizados. As URLs de imagens de runtime não recebem query string de cache-busting.

Veja [docs/pt-BR/ASSETS.md](docs/pt-BR/ASSETS.md).

## Internacionalização e áudio

Inglês é o idioma padrão da primeira execução. Português e espanhol são alternativas ao vivo. O dock fixo de idioma/áudio continua disponível entre telas e durante o gameplay. Trocar idioma não remonta a engine.

O chirp fofo da capitã é exclusivo dos painéis de reação idle; reacts de mecânica como dash/pickups usam o feedback da própria ação e não reproduzem o chirp de idle.

## Arquitetura

Estado contínuo de combate fica em `GameEngine`; React recebe snapshots limitados (aproximadamente a cada 80 ms), e não state por frame. Input fica isolado em `InputManager`, balanceamento em configuração tipada e tipos/assets de runtime em módulos separados.

Veja [ARCHITECTURE.pt-BR.md](ARCHITECTURE.pt-BR.md).

## Testes

Playwright está configurado para Chromium desktop e um perfil touch landscape de Pixel 7. `?e2e=1` fixa a seed do gameplay em `1337` e expõe hooks exclusivos de estado/tempo, mantendo o caminho real da simulação.

Os testes atuais cobrem lock entre armas, auto-fire da Pólvora Viva, i-frame do dash, suporte de emergência e splash ampliado do barril. Veja [docs/pt-BR/TESTING.md](docs/pt-BR/TESTING.md) para o status atual da suíte e as evidências ainda necessárias para avaliação.

## Performance

Desktop mantém antialias e limita a resolução Pixi ao DPR 2. Dispositivos touch/coarse-pointer usam um perfil visual separado: resolução do renderer em 1, sem antialias Pixi, máximo de 50 FPS, menos decoração da água/partículas/trails, wake menos frequente e sem blur filters pesados. Timing de gameplay, IA, dano, colisão e spawn não mudam.

Veja [docs/pt-BR/PERFORMANCE.md](docs/pt-BR/PERFORMANCE.md).

## Documentação

- [ARCHITECTURE.pt-BR.md](ARCHITECTURE.pt-BR.md)
- [docs/pt-BR/CHALLENGE-COMPLIANCE.md](docs/pt-BR/CHALLENGE-COMPLIANCE.md)
- [docs/pt-BR/GAMEPLAY-BALANCE.md](docs/pt-BR/GAMEPLAY-BALANCE.md)
- [docs/pt-BR/TESTING.md](docs/pt-BR/TESTING.md)
- [docs/pt-BR/NETWORK-SCENARIOS.md](docs/pt-BR/NETWORK-SCENARIOS.md)
- [docs/pt-BR/PERFORMANCE.md](docs/pt-BR/PERFORMANCE.md)
- [docs/pt-BR/ASSETS.md](docs/pt-BR/ASSETS.md)
- [docs/pt-BR/ART-DIRECTION.md](docs/pt-BR/ART-DIRECTION.md)
- [docs/pt-BR/THIRD-PARTY-NOTICES.txt](docs/pt-BR/THIRD-PARTY-NOTICES.txt)
