

## Trocar ícone SVG para um navio mais realista

### Problema
O SVG atual é um desenho abstrato/geométrico que não se parece claramente com um navio.

### Solução
Substituir o path SVG por um **ícone de navio/embarcação** mais reconhecível — um cargo ship / vessel com casco, cabine e chaminé. Manter todo o efeito neon (pulse + drop-shadow) já implementado, apenas trocando os `<path>` internos.

O novo SVG será um navio de perfil lateral (silhueta clássica de embarcação marítima), com:
- Casco curvo na base
- Cabine/superestrutura
- Mastro/chaminé

### Alterações

| Arquivo | Alteração |
|---|---|
| `src/components/devices/BrazilMap.tsx` | Trocar os `<path>` dentro do `createShipIcon` por SVG de navio realista |
| `src/components/devices/BrazilMapModal.tsx` | Mesma troca de paths |

Apenas os paths SVG mudam (linhas 170-174 em BrazilMap.tsx e equivalentes em BrazilMapModal.tsx). Todo o resto (pulse, glow, sizing) permanece idêntico.

