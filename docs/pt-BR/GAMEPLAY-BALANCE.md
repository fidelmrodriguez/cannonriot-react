# Balanceamento de gameplay

## Base obrigatória

As regras do desafio permanecem autoritativas: arena visível fixa, movimento para frente + rotação, um projétil frontal, três projéteis paralelos por salva lateral, dano por colisão do Chaser, dano à distância do Shooter, cadência de spawn configurada e exatamente um ponto por inimigo eliminado por ataques do jogador.

Perfil padrão:

- sessão: 120 s;
- spawn de inimigo: 3 s;
- HP do jogador: 100;
- velocidade do jogador: 225 px/s;
- cooldown frontal: 0,38 s;
- cooldown lateral: 1,1 s.

## Configurações extremas

Options permite 60–180 s e intervalos de spawn de 1–8 s. Um valor determinístico de pressão é derivado desses dois parâmetros. Ele influencia cadência de suporte, teto de inimigos e pequenos coeficientes de assistência, não a identidade do ranking nem o valor de pontuação.

```text
pressure = clamp((3 / spawnTime) * (sessionTime / 120)^0.32, 0.7, 2.6)
```

Partidas de alta pressão recebem mais drops de suporte e um teto de inimigos ativos mais restrito. Partidas de baixa pressão evitam assistência excessiva. A intenção é manter todas as configurações permitidas jogáveis sem transformar o padrão em trivial.

## Suporte/powerups

- **Medicine** repara o casco do jogador.
- **Pólvora Viva** acelera e fortalece temporariamente a artilharia e dispara automaticamente o canhão frontal + os dois lados sempre que as recargas aceleradas ficam prontas. A rajada começa ao pegar o power-up e só para quando o efeito termina.
- **Wind at Your Back** aumenta velocidade de movimento e melhora o dash.
- **Reinforced Hull** reduz temporariamente o dano recebido.
- **Powder Barrel** destrói o inimigo que o aciona e causa dano forte porém não letal em um raio ampliado de 170 px, atingindo grupos densos; o navio do jogador é imune ao próprio barril.

Drops de buff priorizam um buff ainda inativo; buffs repetidos estendem a duração em vez de serem desperdiçados. Abaixo de 35% de casco, uma checagem de emergência garante Medicine/Reinforced Hull por perto quando não há suporte adequado próximo, com cooldown de 12 s entre drops de emergência.

## Salvaguardas de justiça

- nenhum inimigo nasce dentro de ilha ou perto demais do jogador;
- inimigos recém-spawnados recebem apenas um telegraph visual curto de `!`; a IA e o timing de ataque não sofrem atraso;
- o dash dura 0,28 s e concede imunidade a projéteis/colisão de aríete somente enquanto o estado de dash está ativo; uma colisão com Chaser nessa janela faz o inimigo se autodestruir sem ferir o jogador e continua sem pontuar, sem tempo extra de proteção depois do dash;
- teto de inimigos ativos escala dentro de limites seguros;
- autodestruição do Chaser não pontua;
- splash do barril não pode causar chain-kill nos navios ao redor;
- sistemas de suporte nunca alteram a regra de um ponto por kill do jogador;
- corpos de navios jogador/inimigo são sólidos; contato com Shooter não causa dano de colisão;
- substeps de projétil impedem que tiros acelerados atravessem colliders.
