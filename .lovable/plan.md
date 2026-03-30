

## Reduzir logo 25% e ajustar espaçamento

**`src/components/Header.tsx`** linha 102-104:

- Reduzir logo de `h-24 w-80` (96px) para `h-[72px] w-60` (75% = 72px altura, 240px largura)
- Aumentar margem negativa para `-ml-3` para compensar melhor o espaço interno da imagem
- Reduzir padding vertical do container de `py-2` para `py-1` para diminuir a altura do bloco

