

## Datas padrão da Visão Geral: período completo do projeto

### Problema
Atualmente as datas iniciam em "hoje/hoje". O comportamento correto é: ao selecionar um projeto, as datas devem cobrir todo o período do projeto (de `created_at` ou `start_date` até hoje). O usuário pode sobrescrever manualmente.

### Solução

**Arquivo: `src/pages/Reports.tsx`**
- Inicializar `startDate` e `endDate` como strings vazias (`''`)
- Adicionar um `useEffect` que, ao selecionar um projeto, busca os dados do projeto selecionado na lista de `projects`
- Usar `project.start_date` (se existir) ou `project.created_at` como data inicial padrão
- Usar a data de hoje como data final padrão
- Se o usuário já alterou manualmente as datas, não sobrescrever (controlar com um flag ou simplesmente sempre atualizar ao trocar de projeto)

```tsx
useEffect(() => {
  if (!selectedProject) return;
  const project = projects.find(p => p.id === selectedProject);
  if (!project) return;
  const projectStart = project.start_date || project.created_at;
  setStartDate(format(parseISO(projectStart), 'yyyy-MM-dd'));
  setEndDate(format(new Date(), 'yyyy-MM-dd'));
}, [selectedProject, projects]);
```

### Arquivos alterados
- `src/pages/Reports.tsx` — adicionar `useEffect` + importar `parseISO`, inicializar datas vazias

