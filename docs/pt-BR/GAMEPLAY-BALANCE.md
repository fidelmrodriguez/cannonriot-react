# Balanceamento de gameplay

## Base obrigatória

As regras centrais do desafio técnico permanecem autoritativas: arena visível limitada, movimento para frente + rotação, um projétil frontal, três projéteis paralelos por lateral, dano/autodestruição do Chaser, dano à distância do Shooter, cadência de spawn configurável e exatamente um ponto por inimigo destruído por um ataque pontuável do jogador.

Perfil padrão:

| Parâmetro | Valor |
| --- | ---: |
| Duração da sessão | 120 s |
| Intervalo de spawn | 3 s |
| Casco do jogador | 100 |
| Velocidade do jogador | 225 px/s |
| Rotação do jogador | 2,9 rad/s |
| Cooldown frontal | 0,38 s |
| Cooldown lateral compartilhado | 1,10 s |
| Lock frontal/lateral | 0,25 s |
| Buffer de input rápido | 0,32 s |
| Dano de projétil inimigo | 14 |
| Dano de colisão do Chaser | 26 |

Options permite sessões de 60–180 s (passos de 10 s) e spawn de 1–8 s (passos de 0,5 s).

## Modelo de pressão

Um valor determinístico de pressão é derivado somente das duas configurações editáveis da partida:

```text
pressure = clamp((3 / spawnTime) * (sessionTime / 120)^0.32, 0.7, 2.6)
```

Pressão não é outra dimensão do ranking. Ela ajusta coeficientes de assistência/performance como:

- teto de inimigos ativos (9–17);
- frequência/chance de suporte;
- pequenos ajustes de vida/dano inimigo em alta pressão;
- assistência de cooldown de dash/barril;
- força/duração dos pickups dentro de limites.

Assim, 180 s / 1 s continua propositalmente intenso sem mudar a regra de um ponto nem alterar silenciosamente o intervalo de spawn escolhido.

## Cadência das armas

No modo normal o jogador mantém acesso às três direções de tiro, mas frontal + lateral não podem disparar exatamente no mesmo instante. Um tiro normal bem-sucedido inicia o lock de 0,25 s. Esquerda/direita compartilham a mesma recarga lateral.

Taps touch podem ficar em buffer por 0,32 s para um toque rápido durante o lock não ser perdido.

**Pólvora Viva** é a exceção explícita: ao coletar, recargas atuais são liberadas e o jogo entra em fogo automático completo. Frontal e as duas laterais disparam sempre que suas recargas aceleradas ficam prontas até o buff acabar; nenhum botão de tiro precisa ser segurado.

## Dash

Valores base:

- cooldown: 2,65 s antes da assistência de pressão/vento;
- duração ativa: 0,28 s;
- distância: 132 px;
- distância com vento: 158 px.

A imunidade existe somente enquanto o estado temporizado do dash está ativo. Quando o dash termina ou é bloqueado por terreno, a proteção acaba imediatamente.

Um Chaser atingido durante o dash se autodestrói sem ferir o jogador. Isso **não** pontua, preservando a regra de colisão do Chaser. Ilhas e limites da arena continuam sólidos durante o dash.

## Pickups e suporte de emergência

Existem quatro pickups:

- **Medicina** — recupera casco;
- **Pólvora Viva** — artilharia automática reforçada;
- **Vento a Favor** — velocidade de movimento + assistência no dash;
- **Casco Reforçado** — multiplicador de dano recebido de 0,64 enquanto ativo.

Drops normais consideram pressão, casco atual e timers de buffs. Buffs temporários repetidos estendem a duração com teto de 1,65× da duração base.

Suporte de emergência ativa com **≤35% de casco** quando não existe Medicina/Armadura num raio de **300 px**. O sistema tenta colocar Medicina ou Armadura a 105–180 px do jogador e então inicia cooldown de **12 s**. Se os quatro slots normais estiverem ocupados, um pickup menos útil/mais distante pode ser removido para abrir espaço.

O suporte ainda exige navegar até a caixa; não é cura direta.

## Barril de pólvora

Valores base:

| Parâmetro | Valor |
| --- | ---: |
| Cooldown base | 6,4 s |
| Lifetime | 10,5 s |
| Tempo para armar | 0,48 s |
| Dano armazenado | 62 |
| Raio da explosão | 170 px |
| Raio de gatilho | 58 px |
| Máximo de barris ativos | 3 |

O inimigo que aciona o barril armado é destruído e pontua normalmente. Outros inimigos dentro do raio ampliado recebem dano forte com falloff, mas o splash é limitado para deixá-los com no mínimo 1 HP. O jogador é imune à própria explosão.

Isso permite enfraquecer 7–10 navios muito agrupados sem transformar um gatilho em massacre automático.

## Salvaguardas de justiça

- pontos de spawn são validados contra ilhas, limites, inimigos próximos e distância mínima do jogador;
- sem ponto seguro, a tentativa é adiada em vez de forçar posição inválida;
- inimigos recém-spawnados recebem somente um `!` visual curto — não existe atraso escondido de ataque;
- i-frame do dash está preso exatamente ao estado de dash, sem graça posterior;
- contato sólido com Shooter não causa dano;
- colisão de Chaser fora do dash causa dano e autodestruição sem ponto;
- substeps de projétil reduzem tunnelling em velocidades reforçadas;
- hits de projétil aplicam dano uma única vez;
- splash do barril não mata inimigos vizinhos;
- sistemas de suporte nunca alteram valor do ponto nem configurações escolhidas.
