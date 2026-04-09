
# Correção de timestamps — Status: Implementado (v2)

## Convenção do sistema
- `access_logs.timestamp` → UTC real no banco
- UI (`src/utils/brt.ts`) → converte para BRT na exibição
- O ControlID envia horário BRT rotulado como UTC

## Arquitetura de correção (v2)

### Responsabilidades
- **Agent (`electron/agent.js`)**: passa o timestamp RAW do dispositivo, sem correção
- **Servidor (`supabase/functions/agent-sync/index.ts`)**: detecta lag ~3h via heurística e aplica +3h automaticamente
- **UI (`src/utils/brt.ts`)**: converte UTC → BRT na exibição, sem lógica extra

### Heurística do servidor
Se `now() - timestamp` está entre 9000s (2h30) e 12600s (3h30):
- O timestamp é BRT cru → aplica +3h para converter para UTC real
- Se o agente JÁ aplicou +3h, o lag será ~100s → fora da faixa → sem dupla correção

### Dados corrigidos
- 3 eventos recentes (`e53bba0b`, `cb2698d3`, `e9c3b24b`) corrigidos com +3h
- Eventos do bulk sync com +3h da migração anterior: corretos (timestamps históricos do ControlID)

## Resultado
- Último evento: exit 18:55 UTC (15:55 BRT) → trabalhador corretamente "fora"
- Ordem cronológica: entry 18:48 → exit 18:51 → entry 18:53 → exit 18:55
- Novos eventos do facial serão corrigidos automaticamente no servidor
- Desktop NÃO precisa ser reconstruído para funcionar (servidor faz a correção)
