

## Enrollment automático ao atualizar trabalhador

### Problema raiz
Quando o usuário atualiza um trabalhador (nome, foto, CPF) pelo formulário "Editar Trabalhador", o sistema apenas salva no banco de dados. Ele **não** dispara o enrollment nos dispositivos ControlID onde o trabalhador já está cadastrado (`devices_enrolled`). O usuário precisa manualmente abrir o dialog de Enrollment e re-sincronizar — e provavelmente não sabe disso.

### Solução
Após salvar um trabalhador que já tem `devices_enrolled` preenchido, disparar automaticamente o enrollment nos dispositivos listados, reutilizando o fluxo existente (`worker-enrollment` edge function + fila de comandos).

### Alterações

**1. `src/components/workers/WorkerManagement.tsx` — WorkerForm.onSubmit**
- Após `updateWorker()` bem-sucedido, verificar se `worker.devices_enrolled` tem dispositivos
- Se sim, chamar `supabase.functions.invoke("worker-enrollment")` com `action: 'enroll'` e os `deviceIds` do `devices_enrolled`
- Mostrar toast informando que o enrollment foi re-enviado automaticamente
- Abrir o tracking dialog (fase `tracking`) com os `commandIds` retornados para o usuário acompanhar

**2. `src/components/workers/WorkerManagement.tsx` — Extrair EnrollmentTracker**
- Extrair a fase `tracking` do `EnrollmentDialog` em um componente reutilizável `EnrollmentTracker`
- Usar esse componente tanto no dialog de enrollment manual quanto no auto-enrollment pós-update

**3. `src/components/workers/WorkerManagement.tsx` — Estado do WorkerManagement**
- Adicionar estado `autoEnrollCommandIds` + `autoEnrollWorker` no componente pai
- Quando o update dispara auto-enrollment, popular esses estados e mostrar um dialog de tracking

### Fluxo do usuário após implementação
1. Edita trabalhador → clica "Atualizar"
2. Dados salvos no banco
3. Se o trabalhador tem dispositivos em `devices_enrolled`:
   - Toast: "Dados atualizados. Re-sincronizando biometria em X dispositivo(s)..."
   - Dialog de tracking abre automaticamente mostrando status dos comandos
4. Se não tem dispositivos: comportamento atual (apenas toast de sucesso)

### Arquivos alterados
- `src/components/workers/WorkerManagement.tsx`

