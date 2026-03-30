

## Mover abas da Administração para seus locais corretos

### Alterações

1. **`src/pages/Admin.tsx`**:
   - Remover o item `schedules` (Agendamentos) e `documents` (Documentos) do array `tabs`
   - Remover imports não utilizados: `ReportScheduler`, `DocumentExpirationCheck`, `Calendar`, `FileWarning`

2. **`src/pages/Reports.tsx`**:
   - Importar `ReportScheduler`
   - Adicionar aba "Agendamentos" com ícone `Calendar` ao final das tabs

3. **`src/pages/PeopleManagement.tsx`**:
   - Importar `DocumentExpirationCheck`
   - Adicionar aba "Documentos" com ícone `FileWarning` ao final das tabs

