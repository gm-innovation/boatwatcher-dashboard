

## Ajustes Finais na Tela de Acesso

### Alterações em `src/pages/AccessControl.tsx`

1. **Botão "Cancelar"** no lugar de "Novo Acesso": trocar texto e ícone (`RotateCcw` → `X` ou sem ícone), label "Cancelar"
2. **Auto-retorno após confirmar**: `handleConfirm` faz beep + toast → chama `handleNewAccess()` após ~1.2s automaticamente (sem ficar na tela de "Acesso Liberado")
3. **Remover `RecentAccessList`** e imports não usados (`sessionLogs`, `CheckCircle2`, `RecentAccessList`)
4. **Remover estado `accessGranted`** e banner "Acesso Liberado" — ao confirmar, volta direto para o teclado
5. **Borda do WorkerCard ao identificar**: passar `borderStatus` baseado no `worker.status` imediatamente ao identificar (`active` → `'granted'`, `blocked` → `'blocked'`, outros → `'pending'`), não esperar confirmação
6. **Logo fallback via projeto**: se `client_id` do terminal for null, buscar `client_id` do projeto e depois a logo da empresa

### Alterações em `src/components/access-control/WorkerCard.tsx`

1. **Avatar maior**: `h-32 w-32`, texto fallback `text-3xl`
2. **Nome maior**: `text-2xl`
3. **Garantir exibição de Função**: já existe no código, mas confirmar que aparece mesmo quando `job_function_name` está definido — manter a linha de "Função"
4. **Remover CardHeader** ("Informações do Trabalhador") para ganhar espaço

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/pages/AccessControl.tsx` | Editar — cancelar, auto-retorno, logo fallback, remover lista recentes, borda imediata |
| `src/components/access-control/WorkerCard.tsx` | Editar — avatar/nome maiores, remover header |

