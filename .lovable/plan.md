

## Aumentar logo e ajustar alinhamento à esquerda

A logo atual usa `h-12 w-40` (48px). Dobrar para `h-24 w-80` (96px altura, 320px largura). Para alinhar com o conteúdo da página, usar `object-contain object-left` e margem negativa à esquerda (`-ml-2`) para compensar o espaço vazio interno da imagem.

### Alteração

**`src/components/Header.tsx`** linha 104:
- Trocar `className="h-12 w-40 object-contain"` por `className="h-24 w-80 object-contain object-left -ml-2"`

