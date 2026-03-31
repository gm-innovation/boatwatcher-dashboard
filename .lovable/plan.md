

## Ajustes na Tela de Acesso

### 1. Remover OfflineIndicator (`AccessControl.tsx`)
- Remover o bloco `<OfflineIndicator ... />` do header de branding
- Remover o import do componente

### 2. Aumentar padding do header (`AccessControl.tsx`)
- Trocar `p-3` para `p-6` no bloco de branding para dar espaço à logo

### 3. Buscar campo `role` do trabalhador (`useOfflineAccessControl.ts`)
- Adicionar `role` ao select da query: `'id, name, code, document_number, photo_url, company_id, status, job_function_id, role'`
- Adicionar `role` ao `CachedWorker` interface: `role?: string | null`
- Mapear `role` no objeto cached

### 4. Exibir Cargo/Função corretamente (`WorkerCard.tsx`)
- Remover o cast `(worker as any).role` — usar `worker.role` tipado
- Garantir que tanto `job_function_name` (Função) quanto `role` (Cargo) sejam exibidos quando presentes

### 5. Centralizar toast na tela (`toast.tsx`)
- Alterar `ToastViewport` de `top-0 ... sm:bottom-0 sm:right-0` para centralizado: `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/pages/AccessControl.tsx` | Remover OfflineIndicator, aumentar padding |
| `src/hooks/useOfflineAccessControl.ts` | Adicionar `role` à interface e query |
| `src/components/access-control/WorkerCard.tsx` | Usar `worker.role` tipado |
| `src/components/ui/toast.tsx` | Centralizar viewport |

