# Direção de arte

Cannon Riot usa uma linguagem de arcade naval cartunesca e saturada: contornos fortes, água ciano/turquesa, cores quentes no jogador, Chasers em coral, Shooters em roxo, UI creme/navy e feedback de impacto exagerado porém legível.

O objetivo é energia visual frenética sem alterar as regras da simulação.

## Regras de legibilidade

1. Silhuetas do jogador e dos inimigos permanecem distinguíveis na escala de gameplay.
2. Chaser e Shooter usam cores e telegraphs de comportamento diferentes.
3. As informações primárias do HUD são sempre casco, tempo e pontuação.
4. Reações, labels de streak e screen shake são apenas apresentação.
5. Cards cômicos evitam as regiões do jogador e dos inimigos ativos sempre que existir espaço livre; sobreposição só é permitida como fallback quando a arena estiver saturada.
6. Perigo por casco baixo usa uma vinheta interna em vez de uma borda vermelha esticada pela tela inteira.

## Pseudo-profundidade

O jogo permanece mecanicamente 2D. O pseudo-3D é apenas apresentação:

- sombras de projéteis + offsets senoidais de arco;
- sombras/rastro dos navios;
- camadas de costa/areia/grama/copa/sombras nas ilhas;
- árvores, pedras e highlights dentro das ilhas;
- faixas de corrente, cáusticas, névoa de recife e ondulações no mar;
- brilho/pulsação da chama de casco danificado.

## Painéis de reação

Painéis de dano, vitória, idle e mecânica são independentes. Um painel nunca cancela outro; cada um desaparece apenas quando o próprio lifetime termina. A proporção original do retrato é preservada em vez de esticar toda imagem para um retângulo fixo.
