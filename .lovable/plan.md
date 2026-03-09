

# Corrigir sobreposicao do seletor de projeto no Header

## Problema

O Header tem 3 secoes empilhadas (logos + nav + seletor de projeto) dentro de um `position: fixed`, mas o conteudo principal usa apenas `pt-28` (~7rem) de padding-top. A altura real do Header e maior que isso, fazendo o seletor de projeto sobrepor o conteudo da pagina.

## Solucao

Aumentar o padding-top do conteudo principal de `pt-28` para `pt-36` (~9rem) no `MainLayout.tsx`, garantindo espaco suficiente para as 3 secoes do Header.

## Arquivo

| Arquivo | Acao |
|---|---|
| `src/components/layouts/MainLayout.tsx` | Editar — trocar `pt-28` por `pt-36` |

