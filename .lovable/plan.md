

## Mapear localização do dispositivo para o dashboard

Atualmente o dashboard usa `device_name` como localização do trabalhador (linha 241 de `useSupabase.ts`). Precisa usar `configuration.access_location` do dispositivo para mostrar "Bordo" ou "Dique".

### Alterações

**`src/hooks/useSupabase.ts` — `fetchWorkersOnBoardFromCloud`**

1. Na query de devices (linha 158-161), incluir `id, configuration` em vez de apenas `id`
2. Criar um mapa `deviceLocationMap: { [deviceId]: 'bordo' | 'dique' }` a partir de `configuration.access_location`
3. Na query de `entryLogs`, incluir `device_id` no select
4. Ao montar o objeto `workersOnBoard`, guardar o `device_id` da entrada
5. Na montagem final (linha 236-247), mapear a localização:
   - Se `access_location === 'dique'` → `location = 'Dique'`
   - Se `access_location === 'bordo'` (ou default) → `location = 'Bordo'`
   - Manter `device_name` como informação secundária (ex: "Bordo" em vez de "Engenharia - Entrada")

**Resultado**: Na tabela de trabalhadores do dashboard, a coluna "Local" mostrará "Bordo" ou "Dique" conforme a configuração do dispositivo pelo qual o trabalhador passou.

