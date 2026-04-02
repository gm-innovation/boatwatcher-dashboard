

## Corrigir scroll, preenchimento automático e visibilidade da foto

### Problemas identificados

1. **Scroll não funciona**: O `ScrollArea` do Radix tem problemas com cálculo de altura em modais. A combinação de `max-h-[95vh]`, `flex flex-col` e `h-[calc(95vh-180px)]` não funciona corretamente. Solução: trocar `ScrollArea` por `div` com `overflow-y-auto` nativo.

2. **Campos não são preenchidos pelos dados extraídos**: Os `Select` de Empresa, Cargo, Gênero e Tipo Sanguíneo são **não-controlados** — usam apenas `onValueChange` sem `value`. Quando `setValue()` do react-hook-form é chamado após extração, o valor interno muda mas o componente Select **não re-renderiza** porque não está vinculado ao `watch()`. Solução: tornar todos os Selects controlados usando `watch('field')` como `value`.

3. **Campo de foto não aparece**: O campo existe na seção "Dados Adicionais", mas como o scroll não funciona, o usuário não consegue rolar até ele. Corrigir o scroll resolve este problema.

### Mudanças no arquivo `src/components/workers/NewWorkerDialog.tsx`

1. **Trocar ScrollArea por div com overflow nativo**:
   - Linha 453: substituir `<ScrollArea className="flex-1 min-h-0 h-[calc(95vh-180px)] pr-4">` por `<div className="flex-1 min-h-0 overflow-y-auto pr-4">`
   - Linha 699: fechar com `</div>` em vez de `</ScrollArea>`
   - Remover import de `ScrollArea` se não usado em outro lugar (ainda é usado no dialog de projetos, manter)

2. **Tornar Selects controlados** — adicionar `watch` para cada campo e usar como `value`:
   - `company_id`: `const watchedCompanyId = watch('company_id');` → `<Select value={watchedCompanyId} onValueChange={...}>`
   - `role`: `const watchedRole = watch('role');` → `<Select value={watchedRole} onValueChange={...}>`
   - `gender`: `const watchedGender = watch('gender');` → `<Select value={watchedGender} onValueChange={...}>`
   - `blood_type`: `const watchedBloodType = watch('blood_type');` → `<Select value={watchedBloodType} onValueChange={...}>`

3. **Mover seção de foto para cima no modo documento**: No modo documento, a foto deve aparecer visível sem muito scroll. Reordenar para que no modo documento a seção "Dados Adicionais" (com foto) fique logo após "Informações Básicas", antes dos documentos — ou alternativamente, manter a ordem atual já que corrigir o scroll resolve a visibilidade.

### Arquivo alterado
- `src/components/workers/NewWorkerDialog.tsx`

