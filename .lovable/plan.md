

## Rejeição com justificativa + desbloqueio no modal

### Problema
1. Rejeição de cadastro não exige justificativa — ruim para auditoria
2. Empresa/trabalhador não recebem notificação do motivo
3. Modal de detalhes não permite desbloquear trabalhador

### Alterações

#### 1. Migration: adicionar coluna `rejection_reason` na tabela `workers`
```sql
ALTER TABLE public.workers ADD COLUMN rejection_reason text;
```

#### 2. `PendingRegistrations.tsx` — Dialog de rejeição com justificativa obrigatória
- Ao clicar "Rejeitar", abre um Dialog com campo de texto obrigatório para o motivo
- Salva `status: 'blocked'` e `rejection_reason` juntos
- Toast de confirmação exibe o motivo

#### 3. `WorkerDetailsDialog.tsx` — Botão "Desbloquear" no modal
- Quando `worker.status === 'blocked'`, exibir um Alert vermelho no topo do modal com o motivo da rejeição (se houver) e um botão "Desbloquear"
- Ao desbloquear, atualiza `status: 'active'` e limpa `rejection_reason`

#### 4. Notificação por email (futura)
- A funcionalidade de email para empresa/trabalhador requer configuração de domínio de email. Vou deixar a estrutura preparada (motivo salvo no banco) e podemos implementar o envio de email como próximo passo após configurar a infraestrutura de email.

### Arquivos modificados
- **Migration SQL**: nova coluna `rejection_reason`
- `src/components/people/PendingRegistrations.tsx`: dialog de rejeição
- `src/components/workers/WorkerDetailsDialog.tsx`: alerta + botão desbloquear
- Interface `Worker` no WorkerDetailsDialog: adicionar `rejection_reason`

