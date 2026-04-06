

## Correção: Limite de 1000 Trabalhadores (Paginação)

### Causa Raiz

O servidor PostgREST do backend tem um limite rígido de **1000 registros por requisição**. Mesmo com `.range(0, 9999)` no código, o servidor trunca a resposta em 1000 linhas. Confirmado pela requisição de rede: `limit=10000` mas apenas 1000 retornados.

O número "38 empresas" é consequência do mesmo problema — conta apenas as empresas presentes nos 1000 primeiros trabalhadores.

### Solução

Implementar **paginação automática** no `fetchWorkers` — buscar em lotes de 1000 até não haver mais dados, e concatenar os resultados.

### Alteração

**Arquivo**: `src/hooks/useDataProvider.ts`

Substituir a query única por um loop de paginação:

```typescript
export async function fetchWorkers() {
  return executeWithDesktopFallback(
    () => localWorkers.list(),
    async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      
      while (true) {
        const { data, error } = await supabase
          .from('workers')
          .select('*, companies(name)')
          .order('code', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = allData.concat(data);
        if (data.length < PAGE_SIZE) break; // última página
        from += PAGE_SIZE;
      }
      
      return allData.map((w: any) => ({
        ...w,
        company: w.companies?.name || 'N/A',
      }));
    },
  );
}
```

Mesma abordagem será aplicada ao `fetchCompanies` para garantir que todas as empresas sejam carregadas (atualmente sem `.range()` explícito, mas sujeito ao mesmo limite de 1000).

### Resultado Esperado
- Aba "Trabalhadores": exibirá todos os 2531 trabalhadores
- Card "Empresas": mostrará o total correto de empresas vinculadas
- Nenhuma alteração de schema ou dados necessária

