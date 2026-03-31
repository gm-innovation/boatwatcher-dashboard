

## Adicionar coordenadas ao cadastro de projetos

### Problema
Ao criar um projeto, não há campo para coordenadas. O mapa usa coordenadas hardcoded no código. Precisamos que cada projeto armazene suas coordenadas e que locais já usados tenham as coordenadas pré-preenchidas.

### Solução

#### 1. Migração: adicionar colunas e tabela de locais conhecidos

Adicionar `latitude` e `longitude` na tabela `projects` e criar uma tabela `known_locations` que guarda coordenadas por nome de local.

```sql
-- Colunas na tabela projects
ALTER TABLE projects ADD COLUMN latitude double precision;
ALTER TABLE projects ADD COLUMN longitude double precision;

-- Tabela de locais conhecidos (auto-populated)
CREATE TABLE known_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE known_locations ENABLE ROW LEVEL SECURITY;

-- RLS: leitura para autenticados, escrita para admins
CREATE POLICY "Authenticated can view known_locations" ON known_locations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert known_locations" ON known_locations
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update known_locations" ON known_locations
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete known_locations" ON known_locations
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
```

#### 2. ProjectForm — campos de coordenadas com auto-preenchimento

No `src/components/settings/ProjectForm.tsx`:

- Adicionar estados `latitude`, `longitude` e `location`
- Buscar `known_locations` via Supabase
- Quando o campo `location` mudar e corresponder a um local conhecido, preencher latitude/longitude automaticamente
- Ao salvar o projeto, se o local for novo, inserir na tabela `known_locations` (upsert)
- Campos de latitude e longitude como inputs numéricos editáveis

#### 3. BrazilMap — usar coordenadas do projeto

Em `src/components/devices/BrazilMap.tsx`, priorizar `project.latitude` / `project.longitude` quando disponíveis, antes de procurar no dicionário hardcoded `LOCATION_COORDS`.

#### 4. Tipo Project

Atualizar `src/types/supabase.ts` — adicionar `latitude` e `longitude` opcionais na interface `Project`.

### Resumo de arquivos alterados

| Arquivo | Alteração |
|---|---|
| Migração SQL | Colunas `latitude`/`longitude` em `projects` + tabela `known_locations` |
| `src/components/settings/ProjectForm.tsx` | Campos de local, latitude, longitude com auto-preenchimento |
| `src/components/devices/BrazilMap.tsx` | Priorizar coordenadas do projeto sobre hardcoded |
| `src/types/supabase.ts` | Adicionar campos ao tipo `Project` |

