
Corrigir a exibição da foto do trabalhador no front.

Diagnóstico
- O bucket `worker-photos` é privado, então a UI não pode usar `worker.photo_url` diretamente como `src`.
- Já existe infraestrutura para isso:
  - `src/utils/storageUtils.ts`
  - `src/hooks/useResolvedUrl.ts`
- Mas os componentes ainda renderizam a foto crua, por exemplo:
  - `src/components/workers/WorkerManagement.tsx`
  - `src/components/workers/WorkerDetailsDialog.tsx`
  - `src/components/company-portal/MyWorkers.tsx`
  - `src/components/people/PendingRegistrations.tsx`
- Há também inconsistência no upload:
  - `WorkerManagement` salva referência privada (`storage://...`) via `storageProvider`
  - `NewWorkerDialog`, `UserRegistration` e `EmployeeForm` ainda salvam signed URL temporária, que expira

Plano
1. Padronizar o formato salvo no banco
- Fazer todos os fluxos de upload de foto salvarem referência persistente da imagem privada, não signed URL temporária.
- Seguir o mesmo padrão do `storageProvider` para `worker-photos`.

2. Corrigir a resolução da foto no front
- Aplicar `useResolvedUrl` onde a foto do trabalhador é exibida.
- Substituir `AvatarImage src={worker.photo_url}` por URL resolvida em todas as telas relevantes.
- Ajustar também o preview inicial da edição para abrir com a imagem resolvida.

3. Melhorar compatibilidade com dados legados
- Estender `resolveFileUrl` para lidar também com URLs antigas já salvas no banco, incluindo signed URLs expiradas quando o path puder ser extraído.
- Se necessário, normalizar strings como `worker-photos/workers/...`.

4. Revisar os pontos principais da UI
- Lista de trabalhadores
- Modal de detalhes
- Pendentes
- Portal da empresa
- Fluxos de cadastro/edição

Resultado esperado
- A foto continua privada no storage
- O banco guarda uma referência estável
- O front gera signed URL apenas na hora de exibir
- As fotos já existentes no bucket passam a aparecer corretamente nas telas

Detalhe técnico
A correção mais segura não é “tornar o bucket público”, e sim usar signed URLs no momento da renderização. O problema hoje é principalmente de consumo da URL no front e de inconsistência entre os fluxos de upload.
