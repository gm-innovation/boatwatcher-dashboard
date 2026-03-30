

## Alinhar dashboard com o sistema em produção

Três diferenças visuais identificadas entre as imagens:

### Alterações

**1. `src/components/dashboard/WorkersOnBoardTable.tsx`**
- Formato da entrada: mudar de `format(..., 'HH:mm')` para `format(..., 'dd/MM HH:mm')` com badge colorido (azul/outline)
- Coluna "Local": renderizar como `<Badge>` colorido (verde para "Bordo", outline para outros) em vez de texto simples
- Manter o Nº sequencial (produção mostra ID real, mas usaremos index+1 por consistência com dados disponíveis — ou podemos usar worker.id se numérico)

**2. `src/components/dashboard/CompaniesOnBoardList.tsx`**
- Substituir layout de cards com ícone por uma **tabela** com 3 colunas: Empresa, Equipe, Entrada
- Adicionar `entryTime` à interface `CompanyOnBoard`
- Renderizar equipe como número simples e entrada como horário `HH:mm` com badge azul

**3. `src/hooks/useSupabase.ts` (`useCompaniesOnBoard`)**
- Capturar o `entryTime` mais antigo (primeira entrada) de cada empresa para popular a coluna "Entrada" na tabela de empresas

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/dashboard/WorkersOnBoardTable.tsx` | Badge no Local, formato dd/MM HH:mm com badge na Entrada |
| `src/components/dashboard/CompaniesOnBoardList.tsx` | Trocar cards por tabela (Empresa, Equipe, Entrada) |
| `src/hooks/useSupabase.ts` | Adicionar `entryTime` ao retorno de `useCompaniesOnBoard` |

