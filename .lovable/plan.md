

## Correção: Autorização em Massa Muito Lenta

### Causa Raiz

O `handleAuthorizeProject` faz um `updateWorker()` individual por trabalhador (PATCH sequencial). Com 111 empresas e ~2500 trabalhadores, são ~2500 requisições HTTP uma a uma — leva minutos sem feedback visual, parecendo que "nada aconteceu".

### Solução

Substituir o loop sequencial por uma **database function (RPC)** que faz o UPDATE em massa no banco, numa única chamada.

### Alterações

**1. Migration — criar função `authorize_companies_to_project`**

```sql
CREATE OR REPLACE FUNCTION public.authorize_companies_to_project(
  _company_ids uuid[],
  _project_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE workers
  SET 
    allowed_project_ids = CASE
      WHEN allowed_project_ids IS NULL THEN ARRAY[_project_id]
      WHEN NOT (allowed_project_ids @> ARRAY[_project_id]) THEN allowed_project_ids || _project_id
      ELSE allowed_project_ids
    END,
    updated_at = now()
  WHERE company_id = ANY(_company_ids)
    AND (allowed_project_ids IS NULL OR NOT (allowed_project_ids @> ARRAY[_project_id]));
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
```

**2. `src/components/people/CompanyManagement.tsx`**

Substituir o `handleAuthorizeProject` para usar RPC em vez do loop:

```typescript
const handleAuthorizeProject = async (projectId: string) => {
  setIsAuthorizing(true);
  try {
    const { data, error } = await supabase.rpc('authorize_companies_to_project', {
      _company_ids: Array.from(selectedCompanyIds),
      _project_id: projectId,
    });
    if (error) throw error;

    toast({
      title: 'Autorização concluída',
      description: `${data} trabalhador(es) de ${selectedCompanyIds.size} empresa(s) autorizado(s).`,
    });

    queryClient.invalidateQueries({ queryKey: ['workers'] });
    setSelectedCompanyIds(new Set());
    setIsProjectDialogOpen(false);
  } catch (error: any) {
    toast({ title: 'Erro ao autorizar', description: error.message, variant: 'destructive' });
  } finally {
    setIsAuthorizing(false);
  }
};
```

Também adicionar um indicador de loading no modal (spinner no botão do projeto clicado).

### Resultado Esperado
- Autorização de 111 empresas (~2500 trabalhadores) executa em **menos de 1 segundo** numa única chamada ao banco
- Toast mostra quantos trabalhadores foram atualizados
- Remover a dependência de `useWorkers()` no componente (não precisa mais carregar todos os workers no client)

