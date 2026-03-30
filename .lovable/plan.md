

## Adicionar card de Logo do Sistema em GlobalSettings

O `GlobalSettings.tsx` não tem o card de logo. Precisa ser adicionado.

### Alteração

**`src/components/admin/GlobalSettings.tsx`**

- Importar `supabase`, `useSystemSetting`, e ícone `ImagePlus`
- Adicionar estados `lightLogoUrl` e `darkLogoUrl`, inicializados a partir da setting `system_logo`
- Adicionar função `handleLogoUpload(mode: 'light' | 'dark')` que:
  1. Faz upload para bucket `company-logos` com path `system/logo_light.{ext}` ou `system/logo_dark.{ext}` (upsert)
  2. Obtém URL pública
  3. Atualiza state local
  4. Salva ambas URLs na `system_settings` key `system_logo` via `updateSetting.mutate`
  5. Atualiza `localStorage` (`company_light` / `company_dark`)
- Adicionar card "Logo do Sistema" antes do card de Reconhecimento Facial, com:
  - Dois campos `<Input type="file" accept="image/*">` (Modo Claro e Modo Escuro)
  - Preview da logo atual abaixo de cada input (fundo branco para claro, fundo zinc-900 para escuro)

**`src/components/Header.tsx`** — Verificar se já usa `useSystemSetting` (se não, adicionar)

| Arquivo | Mudança |
|---|---|
| `GlobalSettings.tsx` | Novo card com upload de logo claro/escuro no topo |
| `Header.tsx` | Confirmar integração com `system_logo` setting |

