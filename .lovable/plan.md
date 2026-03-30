

## Adicionar upload de Logo do Sistema em Administração > Configurações

O Header (linhas 46-48) lê a logo do sistema de `localStorage` (`company_light` / `company_dark`). Atualmente não existe nenhum campo em Administração > Configurações para definir essa logo. A logo dos Clientes é outra coisa (salva na tabela `companies`).

### Alteração

**`src/components/admin/GlobalSettings.tsx`** — Novo card "Logo do Sistema" antes dos demais

- Adicionar card com dois campos de upload de imagem (Modo Claro e Modo Escuro)
- Ao fazer upload:
  1. Upload para bucket `company-logos` com path `system/logo_light.{ext}` ou `system/logo_dark.{ext}` (upsert)
  2. Obter URL pública
  3. Salvar na tabela `system_settings` com key `system_logo`, value `{ light_url, dark_url }` via `updateSetting.mutate`
  4. Atualizar `localStorage` (`company_light` / `company_dark`) para reflexo imediato no Header
- Carregar URLs atuais da setting `system_logo` ao montar e exibir previews (fundo branco para claro, fundo escuro para escuro)
- Imports adicionais: `supabase`, `ImagePlus` icon, `useSystemSetting`

**`src/components/Header.tsx`** — Carregar logo persistida do banco

- Usar `useSystemSetting('system_logo')` para buscar as URLs do banco
- Priorizar a URL do banco sobre o `localStorage` (fallback para localStorage se a query ainda estiver carregando)
- Isso garante que a logo persista entre sessões e dispositivos diferentes

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `GlobalSettings.tsx` | Novo card com upload de logo claro/escuro, persistência no banco + localStorage |
| `Header.tsx` | Ler logo de `system_settings` via hook, com fallback para localStorage |

