
# Correção de timestamps — Status: Implementado

## Convenção do sistema
- `access_logs.timestamp` → UTC real no banco
- UI (`src/utils/brt.ts`) → converte para BRT na exibição
- O ControlID envia horário BRT rotulado como UTC → o agente soma +3h para converter para UTC real

## O que foi feito

### 1. Agent.js (`electron/agent.js`)
- `normalizeTimestamp` já estava correto com `BRT_OFFSET_MS = 3h`
- Nenhuma alteração necessária — o problema era que o desktop não estava rodando o código atualizado

### 2. Agent-sync (`supabase/functions/agent-sync/index.ts`)
- `validateTimestamp` apenas valida sem aplicar correção (correto)
- BRT autocorrection está desabilitada no servidor (correto, responsabilidade é do agente)

### 3. Dados corrigidos
- Aplicado +3h em todos os eventos de dispositivo de 09/04 que estavam como BRT-cru
- Evento `377676e5` (entry 16:59 UTC) já estava correto, não foi tocado
- Conflitos de unique constraint tratados com DO block + EXCEPTION

### 4. Dashboard
- Não alterado — lógica estava correta, só precisava de dados consistentes

## Resultado
- Ordem cronológica restaurada
- Último evento: entry 18:53 UTC (15:53 BRT) → trabalhador "a bordo"
- Próximos eventos do facial entrarão com UTC correto quando o desktop for reconstruído

## Pendência
- O desktop precisa ser reconstruído com o `electron/agent.js` atual para que novos eventos já venham com +3h
