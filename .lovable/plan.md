
Objetivo: eliminar o `FOREIGN KEY constraint failed` de forma definitiva no fluxo de conexão do agente local.

Diagnóstico consolidado  
- Do I know what the issue is? **Sim.**  
- A chamada de pré-sync está chegando na nuvem (status/companies/projects com 200), então a falha acontece no SQLite local durante upsert.  
- O ponto mais frágil atual é `upsertProjectFromCloud`: quando não resolve empresa local, ele ainda tenta salvar `client_id` externo (`|| data.client_id`), o que pode quebrar FK.  
- Há também risco de instalações antigas sem colunas de compatibilidade (`cloud_id`) em tabelas-base, o que derruba a resolução de IDs e causa efeito cascata.

Plano de implementação (revisado)  

1) Corrigir mapeamento FK em `electron/database.js` (projetos)  
- Atualizar `upsertProjectFromCloud` para **nunca** gravar `client_id` externo quando a empresa local não for encontrada.  
- Regra: `localClientId = resolveLocalEntityId('companies', data.client_id) || null`.  
- Se não resolver, salvar projeto com `client_id = null` + log de aviso (não abortar conexão).

2) Blindar `upsertDeviceFromCloud` contra projeto ausente  
- Antes de inserir/atualizar device, validar se `project_id` existe localmente.  
- Se não existir, usar fallback seguro (`project_id = null`) e logar contexto (`device_id`, `project_id`) para diagnóstico.  
- Isso evita quebrar toda a conexão por um único vínculo inconsistente.

3) Adicionar migração de compatibilidade de schema no bootstrap do SQLite  
- Em `initDatabase`, incluir verificação `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` para colunas críticas ausentes em instalações antigas:  
  - `companies.cloud_id`  
  - `projects.cloud_id`  
  - `workers.cloud_id`  
- Manter padrão já usado para outras tabelas (user_companies/company_documents/worker_documents).

4) Tornar o erro do `set-agent-token` acionável em `electron/local-server-main.js`  
- Guardar contadores de sucesso/falha por etapa (companies, projects, devices).  
- Se houver falha, retornar mensagem específica (ex.: “Falha ao salvar projetos: X/Y”).  
- Continuar logando por registro, mas com resumo final para aparecer na UI.

5) Aplicar a mesma robustez no sync periódico (`electron/sync.js`)  
- Reusar as novas regras de FK-safe (`client_id`/`project_id`) no fluxo contínuo para não reaparecer após “Sync Completo”.

Validação (fim a fim)  
1. Conectar com o token que hoje falha.  
2. Confirmar que não aparece mais `FOREIGN KEY constraint failed`.  
3. Verificar que dashboard abre, agente/projeto carregam e dispositivos aparecem.  
4. Rodar “Sync Completo” e confirmar estabilidade sem regressão.
