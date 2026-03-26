

# Manter horário da primeira entrada no dashboard

## Problema
Quando um trabalhador já está a bordo e passa novamente no leitor de entrada, o dashboard mostra o horário da **última** passagem, porque os logs de entrada são ordenados por timestamp **descendente** e o primeiro encontrado (mais recente) é o que fica no mapa.

## Solução
Mudar a ordenação dos `entryLogs` de **descendente** para **ascendente** em `src/hooks/useSupabase.ts` (linha 151). Com isso, o primeiro registro sem saída encontrado para cada trabalhador será o mais antigo (primeira entrada real), e passagens duplicadas posteriores serão ignoradas pelo `!workersOnBoard.has(key)`.

### Alteração
```typescript
// ANTES
.order('timestamp', { ascending: false });

// DEPOIS
.order('timestamp', { ascending: true });
```

### Arquivo alterado
- `src/hooks/useSupabase.ts` — uma linha

