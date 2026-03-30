

## Alinhar estilo visual dos cards com produção (sem toolbar)

Apenas mudanças de estilo CSS nos dois componentes. Sem adicionar busca, filtros ou botão de exportação.

### Alterações

**1. `src/components/dashboard/WorkersOnBoardTable.tsx`**
- Card: `bg-card rounded-lg` → `bg-white dark:bg-card rounded-xl shadow-sm`
- Header padding: `p-4` → `p-6`
- Título: `text-lg` → `text-xl`
- Badge contador: trocar `variant="secondary"` por classes manuais `bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full border-0`
- Badge "Local" (Bordo): trocar `bg-emerald-*` por `bg-green-100 text-green-800` (valor do location vem automaticamente do dispositivo, sem mudança de lógica)
- Badge hora entrada: trocar `variant="outline" text-primary border-primary` por `bg-blue-100 text-blue-800 text-xs rounded-md border-0`
- Linhas da tabela: adicionar `hover:bg-gray-50`

**2. `src/components/dashboard/CompaniesOnBoardList.tsx`**
- Card: mesmas mudanças (`bg-white rounded-xl shadow-sm`)
- Header: `p-4` → `p-6`, título `text-lg` → `text-xl`
- Badge contador: mesmas classes azuis
- Badge hora: `bg-blue-100 text-blue-800 text-xs rounded-md border-0`
- Linhas: `hover:bg-gray-50`

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `WorkersOnBoardTable.tsx` | Estilo card, badges (azul/verde), hover nas linhas |
| `CompaniesOnBoardList.tsx` | Estilo card, badges azuis, hover nas linhas |

