

## Correções Pendentes: Limite de Trabalhadores e Empresas

### Estado Atual do Banco de Dados (confirmado)
- **Trabalhadores**: 2531 registros, códigos 2/3/4 estão corretos (Bruno, Gustavo, Edson)
- **Empresas**: 111 com `type='company'` + 1 DOF com `type='client'` = 112 total
- **DOF**: Existe como `client` E como `company` (duas entradas distintas, correto)
- **Problema 3**: Já está corrigido no banco

### Problema 1: Trabalhadores mostrando apenas 1000
O código em `useDataProvider.ts` já tem `.range(0, 9999)`, mas a mudança pode não ter sido refletida no build atual. O plano é forçar o rebuild tocando o arquivo.

### Problema 2: Empresas mostrando 110 em vez de 111
O banco tem exatamente 111 empresas `type='company'`, sem duplicatas. Isso pode ser um problema de cache do React Query ou o usuário viu antes da criação do DOF company. Vou forçar a invalidação e verificar se há algum filtro adicional no componente `CompanyManagement`.

### Ações

1. **Forçar rebuild** de `src/hooks/useDataProvider.ts` — tocar o arquivo para garantir que o `.range(0,9999)` seja compilado
2. **Verificar** se `CompanyManagement.tsx` ou `CompaniesTable.tsx` aplica algum filtro que exclui uma empresa
3. Se necessário, adicionar `.order('name')` na query de `useContractorCompanies` para garantir ordenação consistente

### Arquivos a modificar
- `src/hooks/useDataProvider.ts` — confirmar/retocar para forçar rebuild
- Nenhuma operação de dados necessária — banco já está correto

