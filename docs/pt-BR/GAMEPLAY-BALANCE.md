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

- cooldown: 2,65 s antes da assistência de pressão;
- duração ativa: 0,28 s;
- distância: 132 px;
- distância com vento: 158 px.

A imunidade existe somente enquanto o estado temporizado do dash está ativo. Quando o dash termina ou é bloqueado por terreno, a proteção acaba imediatamente.

Um Chaser destruído durante o dash não fere o jogador e vale **1 ponto**, porque o dash é um ataque explícito do jogador. A kill usa os portraits normais de vitória com falas próprias de dash. Uma colisão normal de Chaser fora do dash continua sendo autodestruição sem ponto. Ilhas e limites da arena continuam sólidos durante o dash.


## Atrito de casco com Shooter

Shooters roxos continuam sólidos, mas contato casco a casco sustentado agora aplica dano contínuo de atrito:

| Alvo | DPS de atrito |
| --- | ---: |
| Jogador | 4,5 HP/s antes da mitigação de armadura |
| Shooter em contato | 26 HP/s |

O Shooter recebe propositalmente muito mais dano que o jogador. Assim, raspar pode finalizar ou enfraquecer um navio em emergência, mas continua mais lento e arriscado que usar os canhões. O dano do jogador não multiplica pela quantidade de Shooters encostados; cada Shooter ainda recebe o próprio dano de atrito.

O atrito possui dois reacts chartreuse dedicados e cinco falas localizadas. Um react permanece visível durante todo o contato e fica por mais **2,2 s** depois que os cascos se separam.

## Evento neutro-hostil do Kraken

O Kraken é uma terceira facção da arena, não um boss. Apenas um pode ficar ativo por vez e ele ocupa o equivalente a **2 slots do teto de inimigos ativos** enquanto estiver vivo. Ele não desaparece aleatoriamente; só sai quando é derrotado ou quando a própria partida termina.

Valores base:

| Parâmetro | Valor |
| --- | ---: |
| Vida | 180 HP |
| Velocidade | 72 px/s |
| Raio físico | 48 px |
| Alcance do ataque de tentáculo | 150 px |
| Telégrafo | 0,55 s |
| Cooldown do ataque | 2,2 s |
| Raio do impacto | 64 px |
| Dano no jogador | 11 |
| Dano em navios | 18 |
| Dano da colisão do Chaser no Kraken | 32 |

O Kraken recalcula o **alvo vivo mais próximo a cada tick da simulação**, então pode alternar livremente entre jogador, Shooters e Chasers. Ele se move na direção desse alvo e marca o ponto de impacto antes de cada pancada de tentáculo. A navegação pelas ilhas usa um grid de água A* leve, checagem dos segmentos com o collider inteiro, suavização do caminho e recálculo ao detectar stuck, evitando que a criatura fique presa empurrando um collider. O sprite base não sobe e desce mais: quatro tentáculos procedurais leves, anéis de água animados e um squash/stretch sutil criam sensação de nado sem fazer o Kraken parecer voar. O impacto pode ferir jogador e inimigos normais; a imunidade do dash continua valendo se o golpe cair enquanto o estado temporizado do dash estiver ativo.

Inimigos normais próximos podem redirecionar para o Kraken em vez do jogador. Shooters passam a considerá-lo dentro de aproximadamente **420 px** e Chasers dentro de **330 px**, mas proximidade sozinha não faz todo mundo esquecer o jogador: o Kraken também precisa ser o alvo local mais atraente. A histerese de 80 px impede troca nervosa de alvo. Se um tentáculo realmente causar dano num inimigo normal, esse navio entra numa **retaliação forçada de 5 s** contra o Kraken. Shooters podem ferir o Kraken com tiros. Chasers que colidem fisicamente com ele explodem e causam **32 de dano** ao Kraken, sem dar ponto ao jogador.

O primeiro Kraken fica elegível a partir de **30% da duração da partida**, desde que restem pelo menos 15 s. Depois que é derrotado, outro fica elegível após um intervalo determinístico com seed entre **50 e 55 s**. O golpe final causado pelo jogador vale o **+1 ponto** normal; mortes causadas por tiros inimigos ou colisões de Chaser valem zero. A explosão do barril do jogador pode ferir e finalizar o Kraken, mas nunca é uma eliminação garantida.

## Pickups e suporte de emergência

Existem quatro pickups:

- **Medicina** — recupera casco;
- **Pólvora Viva** — artilharia automática reforçada;
- **Vento a Favor** — velocidade de movimento, dash de 158 px e **zero recarga de dash enquanto o buff estiver ativo**;
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
- contato sólido com Shooter aplica dano contínuo assimétrico de atrito (4,5 HP/s no jogador e 26 HP/s no Shooter);
- colisão de Chaser fora do dash causa dano e autodestruição sem ponto;
- substeps de projétil reduzem tunnelling em velocidades reforçadas;
- hits de projétil aplicam dano uma única vez;
- splash do barril não mata inimigos vizinhos;
- sistemas de suporte nunca alteram valor do ponto nem configurações escolhidas.
