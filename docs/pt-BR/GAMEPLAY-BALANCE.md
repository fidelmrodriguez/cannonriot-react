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

## Evento hostil neutro: Kraken

O Kraken é uma terceira facção adicional, não um boss. Ele não substitui a sequência obrigatória de spawn de Chaser/Shooter e não usa barra global de chefe. Só pode existir um Kraken ativo.

| Parâmetro | Valor |
| --- | ---: |
| Vida | 180 HP |
| Velocidade | 70 px/s |
| Raio de colisão | 48 px |
| Referência de percepção | 460 px |
| Alcance do tentáculo | 270 px |
| Telegraph | 0,55 s |
| Cooldown do ataque | 2,2 s |
| Raio de impacto | 64 px |
| Dano no jogador | 11 |
| Dano em navios inimigos | 18 |
| Dano de ram do Chaser no Kraken | 32 |
| Peso no teto de inimigos | 2 slots |

A cada tick da simulação, o Kraken escolhe a entidade viva mais próxima entre jogador, Chasers e Shooters. Ele pode trocar de alvo imediatamente conforme as distâncias mudam. Quando o ataque de tentáculo começa, o ponto de impacto fica travado pelos 0,55 s do telegraph para manter a esquiva legível. A imunidade do dash continua valendo normalmente se o jogador estiver dentro do impacto durante um dash ativo.

Inimigos próximos tratam o Kraken como alvo hostil local quando ele está mais perto que o jogador. Shooters podem entrar em aggro do Kraken a até 420 px; Chasers usam 330 px. Uma margem de saída de 80 px mantém o alvo Kraken estável até o jogador ficar claramente mais próximo ou a criatura sair do alcance estendido. Essa histerese evita troca de alvo a cada frame. Shooters causam o dano normal de canhão no Kraken. Chasers que colidem fisicamente com ele explodem e causam 32 de dano. Mortes provocadas por NPCs nunca geram ponto para o jogador.

O primeiro Kraken fica elegível após 30% da duração configurada, somente com pelo menos 15 s restantes e dois slots livres no teto de inimigos. Quando fica elegível, os spawns normais reservam esses dois slots até o Kraken entrar, evitando que o perfil saturado de spawn a cada 1 s impeça o evento indefinidamente. Depois de derrotado, outro pode ficar elegível 50–55 s mais tarde. Ele **não** desaparece aleatoriamente; fora o encerramento da partida, fica no mapa até ser derrotado. Se a derrota for causada pelo jogador, vale exatamente **1 ponto**.

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

Um Chaser/Shooter normal que aciona o barril armado é destruído e pontua normalmente. O Kraken também pode acionar o barril, mas recebe os 62 de dano armazenado em vez de morrer automaticamente. Outros navios inimigos normais dentro do raio ampliado recebem dano forte com falloff limitado para deixá-los com no mínimo 1 HP; um Kraken dentro da explosão pode receber o falloff normalmente. O jogador é imune à própria explosão.

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
- splash do barril não mata navios inimigos normais vizinhos; o dano no Kraken não usa esse clamp;
- sistemas de suporte nunca alteram valor do ponto nem configurações escolhidas.
