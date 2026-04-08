

## Controle de Acesso Offline-First: Correção dos bugs reais

### Diagnóstico dos bugs atuais

O sistema já usa IndexedDB como banco de dados local (via `idb-keyval`). O problema não é a ausência de armazenamento local, mas sim 4 bugs concretos que impedem o funcionamento:

**Bug 1 — Configuração do terminal não é cacheada.**  
`AccessControl.tsx` carrega o terminal via `useQuery` do banco remoto. Offline = sem terminal = tela "Nenhum terminal configurado" = não funciona.

**Bug 2 — Chave de cache inconsistente.**  
A tela principal usa `ac_workers_cache_{projectId}`. A tela de configuração usa `ac_workers_cache` (sem projectId). Sincronização manual da config nunca popula o cache que a tela principal lê.

**Bug 3 — Resultado vazio não usa fallback.**  
Se a query retornar 0 resultados (RLS, timeout, etc.), o hook não faz fallback ao cache. Workers fica como `[]` e qualquer código vira "não encontrado".

**Bug 4 — Filtro "Todos os clientes" quebrado.**  
O select da config tem `value="all"`, que faz `.eq('company_id', 'all')` e retorna zero resultados, sobrescrevendo o cache com array vazio.

### Plano de correção

#### 1. Cachear o terminal ativo em IndexedDB
- Em `AccessControl.tsx`, após carregar o terminal do Supabase, salvar em IndexedDB (`ac_active_terminal`).
- Na `queryFn`, se offline, ler do cache local.
- Isso permite que o app funcione 100% offline após a primeira sincronização.

#### 2. Unificar a chave de cache
- Em `AccessControlConfig.tsx`, usar a mesma função `workersCacheKey(projectId)` do hook principal.
- Derivar o `projectId` do terminal ativo (mesmo terminal que a tela principal usa).
- Incluir `rejection_reason` e `allowed_project_ids` nos objetos cacheados pela config.

#### 3. Corrigir fallback para resultado vazio
- Em `useOfflineAccessControl.ts`, se a query retornar `null` ou array vazio, fazer fallback ao cache existente em vez de manter `workers = []`.
- Sempre atualizar o cache quando houver dados reais, mas nunca sobrescrever com vazio.

#### 4. Corrigir filtro "all"
- Em `AccessControlConfig.tsx`, tratar `syncClientId === 'all'` como sem filtro (não aplicar `.eq`).

#### 5. Adicionar loading gate na tela principal
- Desabilitar o teclado numérico e botão de verificação enquanto `loadingWorkers === true`.
- Exibir contagem de trabalhadores carregados no header do terminal para feedback visual.

### Arquivos a alterar
1. `src/hooks/useOfflineAccessControl.ts` — fallback de cache vazio
2. `src/pages/AccessControl.tsx` — cache do terminal + loading gate + contagem
3. `src/pages/access-control/AccessControlConfig.tsx` — chave de cache unificada + fix "all" + campos completos

