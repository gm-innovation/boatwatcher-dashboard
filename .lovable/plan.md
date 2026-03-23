

## Diagnóstico

Existem dois problemas distintos:

### Problema 1: Trabalhador não aparece no desktop

**Causa raiz encontrada**: O trabalhador "Alexandre Silva" tem `allowed_project_ids: []` (array vazio) no banco de dados da nuvem. O endpoint `download-workers` filtra com `.contains('allowed_project_ids', [agent.project_id])`, portanto trabalhadores sem projeto atribuido nunca chegam ao SQLite local. Na web ele aparece porque o admin consulta a tabela `workers` diretamente (sem filtro de projeto).

Dado o modelo de negocio (docagem com armador, terceirizadas, tripulantes), a logica de sync precisa ser mais abrangente: alem dos trabalhadores com `allowed_project_ids` contendo o projeto do agente, tambem deve incluir todos os trabalhadores ativos das empresas vinculadas ao projeto (client + terceirizadas com trabalhadores cadastrados).

### Problema 2: Erro de atualização (server.yml 404)

O auto-updater do Local Server usa `channel: 'server'` e busca `server.yml` no GitHub Release. O release v1.2.1 so contem `latest.yml` (Desktop) — o build do Local Server nao foi publicado nesse release, ou o `server.yml` nao foi gerado. A versao instalada (v1.0.0) tenta atualizar e recebe 404.

---

## Plano de correção

### Correção 1 — Ampliar filtro de download de workers (backend function)

Arquivo: `supabase/functions/agent-sync/index.ts` (endpoint `download-workers`)

Logica atual:
```sql
.contains('allowed_project_ids', [agent.project_id])
.eq('status', 'active')
```

Nova logica (3 criterios OR):
1. `allowed_project_ids` contem o `project_id` do agente (atual)
2. `company_id` = `client_id` do projeto do agente (funcionarios do armador)
3. `company_id` de qualquer empresa que tenha trabalhadores com `allowed_project_ids` contendo o projeto (terceirizadas)

Implementação simplificada: buscar o `client_id` do projeto, depois fazer query com `.or()`:
```
allowed_project_ids.cs.[project_id], company_id.eq.client_id
```

Isso garante que trabalhadores do armador (mesmo sem projeto atribuido) e terceirizados autorizados apareçam no desktop.

### Correção 2 — Garantir publicação do server.yml no CI

Arquivo: `.github/workflows/desktop-release.yml`

O workflow atual executa `npm run build:local-server:publish` antes do Desktop, o que deveria gerar o `server.yml`. O problema pode ser que o build falhou silenciosamente ou que os artefatos nao foram uploadados ao release.

Correções:
- Separar o step do Local Server em job proprio ou adicionar validação pos-build
- Adicionar verificação explicita de que `server.yml` existe nos artefatos antes de prosseguir
- Garantir que `generateUpdatesFilesForAllChannels: false` esteja no config para evitar conflitos

### Correção 3 — Fallback gracioso no auto-updater do Local Server

Arquivo: `electron/local-server-main.js`

Quando o `server.yml` retorna 404, a mensagem de erro atual é crua e confusa. Melhorar para:
- Detectar erro 404 especificamente
- Mostrar mensagem amigavel: "Nenhuma atualização disponível para o Servidor Local nesta versão. Baixe a versão mais recente manualmente."
- Manter botão funcional para tentar novamente

Arquivo: `electron/server-ui.html`
- No handler de erro do updater, tratar o caso 404 com texto orientativo em vez de exibir o stack trace completo

### Arquivos modificados
- `supabase/functions/agent-sync/index.ts` — ampliar filtro de workers
- `.github/workflows/desktop-release.yml` — validação de artefatos
- `electron/local-server-main.js` — fallback de erro no updater
- `electron/server-ui.html` — mensagem amigavel para 404

