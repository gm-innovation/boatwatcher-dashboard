

## Diagnóstico Confirmado

**Dados do Postgres**: ZERO eventos faciais desde 14:08 UTC. ZERO chamadas de `upload-logs`. A telemetria confirma `captured=0, unsynced=0, uploaded=0`.

**Causa raiz**: O agente está rodando, faz login nos 2 dispositivos com sucesso, mas o `lastEventId` armazenado no SQLite local é maior ou igual ao ID máximo atual no buffer do ControlID. A query `WHERE id > lastEventId` retorna 0 eventos. O agente acha que não há eventos novos, quando na verdade os IDs foram resetados ou o cursor está obsoleto.

As screenshots do usuário confirmam que os dispositivos TÊM eventos (94 e 299 acessos registrados). O problema é exclusivamente no cursor do agente.

---

## Correção: `electron/agent.js` — Auto-recuperação do cursor

### Mudança no método `pollDevice` (linhas 334-424)

Quando `load_objects.fcgi` retorna 0 eventos e `lastEventId > 0`, fazer uma segunda consulta **sem filtro de ID** para verificar se existem eventos no dispositivo:

```javascript
// Após processar events (linha 396-411):

if (events.length === 0 && lastEventId > 0) {
  // Possible stale cursor — query without ID filter to check
  const fallbackPayload = JSON.stringify({ object: 'access_logs' });
  // ... fazer nova request sem WHERE clause
  // Se encontrar eventos com max ID < lastEventId → resetar cursor para 0
  // Se encontrar eventos com max ID >= lastEventId → cursor está correto, sem novos eventos
}
```

A lógica concreta:
1. Se `events.length === 0` e `lastEventId > 0`, refaz a consulta sem `where`
2. Se a consulta retorna eventos, pega o `maxId` deles
3. Se `maxId < lastEventId` → o dispositivo resetou seus IDs → `setLastEventId(device, 0)` e reprocessa
4. Se `maxId >= lastEventId` → nenhum evento novo de fato, tudo certo

### Proteção adicional: auto-reset periódico

No `pollDevices()`, se `_capturedCount === 0` por mais de 10 minutos de uptime, resetar todos os cursores automaticamente. Isso garante recuperação mesmo em cenários inesperados.

### Resumo

| Cenário | Comportamento atual | Após correção |
|---|---|---|
| ControlID resetou buffer de IDs | Cursor > max ID → 0 eventos eternamente | Detecta e reseta cursor |
| Cursor ficou alto por bug anterior | Idem | Auto-reset após 10min sem capturas |
| Nenhum evento novo de fato | 0 eventos (correto) | Verifica sem filtro, confirma, não faz nada |

**Nota**: Esta mudança só terá efeito após rebuild do Desktop. Mas é a única peça que falta — manual já funciona em ambas as plataformas, a autocorreção BRT está deployada, o cloud-first está ativo.

