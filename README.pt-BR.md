# Cannon Riot

Cannon Riot é um shooter naval 2D top-down criado para o desafio técnico **React & PixiJS — Pirate Battle**. O React é responsável pela interface da aplicação e pelas telas de dados remotos; o PixiJS é responsável pela arena de combate em tempo real. O TypeScript roda em modo strict, Axios + TanStack Query consomem endpoints REST simulados com MSW e Playwright cobre os fluxos no navegador.

> Documentação padrão da entrega em inglês: [README.md](README.md)

## Executar localmente

Requisitos:

- Node.js 22 LTS
- npm

```bash
npm ci
npm run dev
```

No Windows, também é possível executar `start-windows.bat`.

Não existem variáveis de ambiente obrigatórias. Ranking e histórico de partidas são simulados no navegador pelo MSW em desenvolvimento, preview e build publicado.

## Comandos

```bash
npm run dev              # servidor de desenvolvimento Vite
npm run build            # projetos TypeScript strict + build de produção Vite
npm run preview          # preview do build de produção
npm run lint             # verificações de higiene do repositório
npm run typecheck        # verificação TypeScript strict
npm run test:e2e         # suíte Playwright Chromium (desktop + mobile)
npm run test:e2e:ui      # modo UI do Playwright
npm run test:e2e:update  # atualiza baselines visuais de forma intencional
npm run test:e2e:report  # abre o relatório HTML
npm run check            # lint + typecheck + build de produção
```

Instale o navegador do Playwright uma vez quando necessário:

```bash
npx playwright install chromium
```

## Controles

### Teclado

| Ação | Controle |
| --- | --- |
| Avançar | `W` / `Seta para cima` |
| Girar esquerda/direita | `A` / `D` ou setas |
| Canhão frontal | `Espaço` |
| Salva lateral esquerda/direita | `Q` / `E` |
| Dash | `Ctrl` |
| Barril de pólvora | `R` |
| Pausar/retomar | `P` / `Esc` |

### Touch

Dispositivos touch usam um leme virtual à esquerda e controles de artilharia à direita. Movimento e disparo podem ser mantidos simultaneamente. A orientação suportada é landscape. Quando o navegador permite bloquear orientação, o app solicita landscape após um gesto do usuário; caso contrário, a camada touch preserva uma viewport horizontal para o jogo.

## Identidade do jogador

O desafio exige identificação do jogador em ranking/histórico, mas não define autenticação nem cadastro de conta. Por isso, Cannon Riot cria um `playerId` local persistente uma única vez e disponibiliza um nome de exibição editável no menu principal antes de jogar. Partidas concluídas capturam os dois valores. Não existe login nem provedor externo de identidade.

## Regras de gameplay

O mundo autoritativo é uma arena fixa de 1280×720. Redimensionamento altera apenas a escala de apresentação.

- O jogador avança e gira para esquerda/direita.
- A arma frontal dispara um projétil.
- Cada salva lateral dispara três projéteis paralelos.
- Chasers perseguem e se autodestroem ao colidir com o jogador; essa autodestruição não dá ponto.
- Shooters se aproximam, procuram linha de visão, mantêm distância de combate e disparam contra o jogador.
- Ilhas e limites da arena bloqueiam navios; ilhas também bloqueiam projéteis.
- Cada projétil pode aplicar dano uma única vez e então é removido ao atingir alvo, obstáculo, expirar ou sair da arena.
- Cada inimigo destruído por ataques do jogador vale exatamente um ponto.
- A partida termina quando o tempo ativo da simulação acaba ou quando o casco do jogador chega a zero.
- Pausa manual, blur e aba oculta suspendem simulação/cooldowns. A retomada sempre exige ação do jogador.
- Reiniciar cria uma nova instância limpa da engine e um novo id/seed de partida.

A partida padrão dura 120 segundos e usa intervalo de spawn de 3 segundos. Options expõe os limites exigidos pelo desafio: 60–180 segundos e 1–8 segundos.

## Mecânicas arcade extras

Dash, caixas de reparo, powerups temporários e barris de pólvora são mecânicas adicionais. Eles não alteram a regra obrigatória de um ponto por inimigo eliminado. A assistência adaptativa é derivada apenas da duração escolhida e do intervalo de spawn, para que configurações extremas continuem jogáveis sem alterar silenciosamente a chave do ranking.

Veja [docs/pt-BR/GAMEPLAY-BALANCE.md](docs/pt-BR/GAMEPLAY-BALANCE.md).

## Configuração da partida e comparabilidade do ranking

Cada partida recebe um snapshot via `structuredClone` da configuração atual quando começa. Alterar Options depois não modifica uma partida em andamento.

A comparabilidade do ranking é deliberadamente limitada aos dois parâmetros editáveis exigidos pelo desafio:

```ts
{
  sessionTime,
  enemySpawnTime,
}
```

Uma partida de 120s / 3s nunca concorre diretamente com uma de 180s / 1s. Cada partida confirmada permanece como uma entrada individual no ranking. A ordenação é: pontuação decrescente, duração efetiva crescente, timestamp da partida crescente e, por fim, `matchId` para desempate totalmente determinístico.

## Registros de partida, idempotência e recuperação

Uma partida concluída recebe um UUID antes da requisição. O registro contém identidade da partida/jogador, data, pontuação, duração efetiva da simulação, motivo do fim, snapshot de configuração e seed.

Antes do POST, a partida é adicionada a uma **outbox** local. A outbox é um array, e não um único slot pendente; portanto um envio com falha nunca bloqueia outra partida. Envios bem-sucedidos removem apenas o próprio `matchId`.

O MSW trata `matchId` de forma idempotente: um retry depois de timeout devolve o registro já armazenado em vez de inserir duplicata. Entradas pendentes sobrevivem a refresh. Cannon Riot tenta reenviar a outbox no bootstrap e também quando retorna ao menu principal, tornando reproduzível o fluxo “backend indisponível no game over → restaurar rede → recuperar”.

Partidas abandonadas nunca entram na outbox, ranking ou histórico.

## TanStack Query e Axios

- Chave do Ranking: configuração + página.
- Chave do History: `playerId` local + página.
- Axios recebe o `AbortSignal` do TanStack Query, então requests cancelados/obsoletos param também no cliente HTTP.
- Ranking e histórico são invalidados depois de um registro bem-sucedido.
- As queries refazem fetch quando a aba correspondente é exibida novamente.
- Estados de loading, vazio e erro são renderizados explicitamente.
- Cache/background update ficam sob responsabilidade do TanStack Query, em vez de estado manual no componente.

## Cenários de rede

Os controles de cenário de rede ficam ocultos da interface normal do jogador. Abra o app com `?dev=1` (ou `?e2e=1` nos testes automatizados) e então use **Options → Network Scenario**. Os cenários MSW selecionáveis são:

- sucesso normal;
- listas vazias;
- múltiplas páginas;
- resposta lenta;
- timeout genérico da requisição;
- latência variável determinística;
- respostas fora de ordem;
- falha de conexão;
- HTTP 422;
- HTTP 503;
- falha somente no ranking;
- falha somente no histórico;
- timeout depois de o servidor já ter armazenado a partida;
- backend indisponível no encerramento da partida.

**Restore calm seas** restaura o cenário normal e limpa o banco mock. A outbox do cliente é preservada de propósito para que a recuperação possa ser demonstrada depois que a rede for restaurada.

Veja [docs/pt-BR/NETWORK-SCENARIOS.md](docs/pt-BR/NETWORK-SCENARIOS.md).

## Internacionalização

Inglês é o idioma padrão na primeira execução, atendendo ao requisito do desafio de que a solução seja apresentada em inglês. Português e espanhol são traduções extras em tempo real. Os controles globais de idioma usam artes de bandeira dos Estados Unidos, Brasil e Espanha, aparecem desde a primeira tela de loading e continuam disponíveis durante o gameplay. Trocar idioma não recria a engine PixiJS.

## Arquitetura

O projeto mantém o estado contínuo de combate dentro de `GameEngine`; o React recebe snapshots com frequência limitada, em vez de estado a cada frame. Input fica isolado em `InputManager`; balanceamento é centralizado em configuração tipada; assets de renderização e tipos de entidade ficam em módulos separados. O cleanup para Strict Mode destrói a aplicação Pixi, remove listeners de teclado/visibilidade, desconecta `ResizeObserver` e remove callbacks de ticker.

Veja [ARCHITECTURE.pt-BR.md](ARCHITECTURE.pt-BR.md).

## Testes

Playwright está configurado para Chromium desktop e para um perfil touch em landscape. A suíte E2E usa seed fixa (`?e2e=1`) e um hook explícito de relógio de simulação somente para testes, mantendo regras reais de gameplay, colisões e caminhos de input.

O mapeamento para cada categoria do desafio está em [docs/pt-BR/TESTING.md](docs/pt-BR/TESTING.md).

## Performance

O renderer limita DPR a 2, limita delta da simulação, restringe densidade de inimigos em configurações extremas, aplica orçamento de partículas, reutiliza texturas pré-carregadas e remove callbacks temporários de ticker quando os efeitos terminam.

O desafio também exige profiling empírico do build otimizado (partida de 3 minutos + cinco ciclos entrar/jogar/sair). O procedimento e os campos de evidência estão em [docs/pt-BR/PERFORMANCE.md](docs/pt-BR/PERFORMANCE.md). Números de runtime precisam ser medidos na máquina/navegador da entrega final; não devem ser inventados.

## Documentação

- [ARCHITECTURE.pt-BR.md](ARCHITECTURE.pt-BR.md)
- [docs/pt-BR/CHALLENGE-COMPLIANCE.md](docs/pt-BR/CHALLENGE-COMPLIANCE.md)
- [docs/pt-BR/TESTING.md](docs/pt-BR/TESTING.md)
- [docs/pt-BR/NETWORK-SCENARIOS.md](docs/pt-BR/NETWORK-SCENARIOS.md)
- [docs/pt-BR/GAMEPLAY-BALANCE.md](docs/pt-BR/GAMEPLAY-BALANCE.md)
- [docs/pt-BR/PERFORMANCE.md](docs/pt-BR/PERFORMANCE.md)
- [docs/pt-BR/ASSETS.md](docs/pt-BR/ASSETS.md)
- [docs/pt-BR/ART-DIRECTION.md](docs/pt-BR/ART-DIRECTION.md)
- [docs/pt-BR/THIRD-PARTY-NOTICES.txt](docs/pt-BR/THIRD-PARTY-NOTICES.txt)

As versões em inglês permanecem na raiz e em `docs/`, como documentação padrão da entrega.
