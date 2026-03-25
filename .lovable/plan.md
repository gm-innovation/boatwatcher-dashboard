

## Definir Direção (Entrada/Saída) por Dispositivo

### Situação Atual
O campo `direction` nos logs de acesso vem do payload do evento ControlID (`event.direction`), mas o dispositivo nem sempre envia essa informação — resultando em `'unknown'`. Não existe configuração no sistema para definir qual dispositivo é de entrada e qual é de saída.

### Solução
Usar o campo JSONB `configuration` já existente na tabela `devices` para armazenar `passage_direction: 'entry' | 'exit'`. Sem necessidade de migration.

### Arquivos a alterar

**1. `src/components/devices/DeviceManagement.tsx`**
- Adicionar campo "Direção de Passagem" (Select: Entrada / Saída) no formulário de criação de dispositivo
- Salvar o valor em `configuration.passage_direction`
- Exibir badge "Entrada" / "Saída" no `DeviceCard`
- Permitir edição inline (ou via dialog) da direção em dispositivos já cadastrados

**2. `supabase/functions/controlid-webhook/index.ts`**
- Na função `mapDirection`, usar `device.configuration.passage_direction` como fallback quando o evento não traz direção:
```
const direction = event.direction 
  ? mapDirection(event.direction) 
  : (device.configuration?.passage_direction || 'unknown')
```

**3. `server/lib/controlid.js`** (servidor local)
- Aplicar a mesma lógica: ao processar evento de acesso, usar `device.configuration.passage_direction` como fallback para a direção.

**4. `src/types/supabase.ts`**
- Não precisa de alteração — `configuration` já é `Record<string, any>`.

### Resultado
- Ao cadastrar/editar um dispositivo, o operador define se é entrada ou saída
- Logs de acesso passam a registrar corretamente a direção mesmo quando o hardware não informa
- Dashboard e relatórios refletem entrada/saída com precisão

