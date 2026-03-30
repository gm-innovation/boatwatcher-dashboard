

## Corrigir alinhamento e layout consistente em todas as páginas

### Problema raiz
O `MainLayout` já aplica `px-4 sm:px-6 lg:px-8` no `<main>`, mas as páginas individualmente aplicam layouts inconsistentes:
- **Index.tsx**: aplica `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` novamente → **padding duplicado**
- **Reports.tsx**, **Admin.tsx**, **PeopleManagement.tsx**: usam `max-w-7xl mx-auto` sem padding extra (correto)
- O resultado é que cada página se comporta de forma diferente, causando desalinhamento visual

### Solução
Centralizar o controle de largura máxima e padding no `MainLayout`, removendo duplicações das páginas.

### Alterações

**1. `src/components/layouts/MainLayout.tsx`**
- Adicionar `max-w-7xl mx-auto` ao `<main>` para que todas as páginas fiquem centralizadas uniformemente

**2. `src/pages/Index.tsx`**
- Remover o wrapper `<div className="min-h-screen bg-background">` e o `<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">` duplicado
- Renderizar apenas `<Dashboard projectId={selectedProjectId} />`

**3. `src/pages/Reports.tsx`**
- Remover `max-w-7xl mx-auto` do div wrapper (já vem do MainLayout)

**4. `src/pages/Admin.tsx`**
- Remover `max-w-7xl mx-auto` do div wrapper

**5. `src/pages/PeopleManagement.tsx`**
- Remover `max-w-7xl mx-auto` do div wrapper

### Resultado
Todas as páginas terão exatamente o mesmo alinhamento horizontal, controlado por um único ponto: o `MainLayout`.

