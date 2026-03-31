

## Adicionar campos de coordenadas ao formulário de projetos da Administração

### Problema
Os campos de latitude, longitude e o auto-preenchimento por local conhecido foram implementados apenas no `ProjectForm` da página de Configurações. O formulário principal usado na prática — o dialog "Editar/Novo Projeto" em `src/components/admin/ProjectsManagement.tsx` — não possui esses campos.

### Solução

#### Arquivo: `src/components/admin/ProjectsManagement.tsx`

1. Adicionar estados `latitude` e `longitude` ao `ProjectForm` interno, carregando do projeto quando em edição
2. Buscar `known_locations` via Supabase ao montar o componente
3. Quando o campo `location` mudar e corresponder a um local conhecido, auto-preencher latitude/longitude
4. Incluir latitude/longitude no `projectData` enviado ao salvar
5. Ao salvar, fazer upsert na tabela `known_locations` se houver coordenadas preenchidas
6. Adicionar uma nova row no formulário (após Localização) com dois inputs numéricos: Latitude e Longitude

#### Layout do formulário (nova row após Armador + Localização)

```text
| Armador          | Localização        |
| Latitude         | Longitude          |   ← nova row
| Tipo de Projeto  | Data de Início     |
```

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/components/admin/ProjectsManagement.tsx` | Adicionar campos latitude/longitude, buscar known_locations, auto-fill e upsert ao salvar |

