

## Adicionar campo de Logo Rotacionada (Etiquetas) separado da Logo Dark

### Problema
O campo `logo_url_dark` está sendo usado para a "Logo Rotacionada (Etiquetas)" em vez da logo dark mode real. O sistema precisa de 3 logos distintas:
1. **Logo Normal** (light mode) — `logo_url_light`
2. **Logo Dark** (dark mode) — `logo_url_dark` (será corrigido para este propósito)
3. **Logo Rotacionada** (etiquetas) — novo campo `logo_url_rotated`

### Alterações

**1. Migração de banco de dados**
- Adicionar coluna `logo_url_rotated TEXT` na tabela `companies`
- Migrar dados existentes: copiar `logo_url_dark` para `logo_url_rotated` (pois o conteúdo atual é a logo rotacionada, não a dark)
- Limpar `logo_url_dark` (pois contém dados errados)

**2. `src/components/admin/ClientsManagement.tsx`**
- Adicionar estado `logoUrlRotated` e ref `rotatedLogoRef`
- Reorganizar o bloco de logos para 3 colunas:
  - Logo Normal — `logo_url_light`
  - Logo Dark Mode — `logo_url_dark`
  - Logo Rotacionada (Etiquetas) — `logo_url_rotated`
- Incluir `logo_url_rotated` no payload de submit

**3. `src/types/supabase.ts`**
- Adicionar `logo_url_rotated` ao tipo `Company` (o types.ts do Supabase será atualizado automaticamente pela migração)

**4. `src/components/settings/CompanyForm.tsx`**
- Atualizar formulário para ter 3 campos de logo separados (Normal, Dark, Rotacionada)

