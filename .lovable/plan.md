

# Limpar backlog e sincronizar logs a cada 5 segundos

## Problema

1. **465 logs acumulados** que nunca foram enviados — provavelmente duplicatas ou erros antigos que travam a fila
2. **Upload envia tudo de uma vez** (465 logs = request enorme → timeout ou erro parcial → fila nunca drena)
3. **Ciclo de sync principal é 60s**, não 5s — o fast-lane só dispara quando um evento novo chega, não limpa backlog
4. **Quando o upload falha, nada é marcado como synced** — os mesmos 465 logs ficam tentando eternamente

## Plano

### 1. Upload em lotes + tolerância a duplicatas (`electron/sync.js`)

Refatorar `uploadLogs()`:
- Dividir em **batches de 50**
- Para cada batch: enviar → se sucesso, marcar como synced → próximo batch
- Se o servidor retornar erro `23505` (duplicata) mas `success: true` no response geral → marcar como synced
- Se o batch falhar completamente → parar e tentar o resto no próximo ciclo
- Adicionar um **teto de tempo** (ex: 10s total) para não travar o ciclo inteiro

### 2. Ciclo de upload a cada 5 segundos (`electron/sync.js`)

Criar um **loop dedicado de upload de logs** separado do sync principal (que continua em 60s para dados pesados como workers/devices):

```text
start():
  syncInterval = 60s  → triggerSync() (workers, devices, companies, etc.)
  logUploadInterval = 5s → uploadLogs() (apenas logs pendentes)
```

Assim, mesmo sem fast-lane, logs pendentes são enviados a cada 5s. Quando a fila está vazia, o upload retorna instantaneamente.

### 3. Flush completo ao voltar online (`electron/sync.js`)

No `checkAndSync()`, quando detectar transição offline → online:
- Executar `uploadLogs()` imediatamente (antes do sync completo)
- Isso garante que qualquer acúmulo offline seja drenado na reconexão

### 4. Endpoint para limpar backlog manualmente (`server/routes/sync.js`)

Adicionar rota `POST /api/sync/flush-stale-logs`:
- Marca como synced todos os logs com mais de 24h que nunca foram enviados
- Isso limpa o backlog atual de 465 eventos de uma vez
- Resposta inclui quantos foram limpos

### 5. Auto-limpeza no boot (`electron/sync.js`)

Na inicialização, se houver mais de 200 logs unsynced com mais de 24h:
- Log de warning
- Marcar como synced automaticamente (dados muito antigos provavelmente já estão na nuvem por outra via, ou são irrecuperáveis)

### 6. Bump de versão (`electron/package.json`)

## Arquivos modificados

- `electron/sync.js` — batching, loop 5s, flush on reconnect, auto-cleanup
- `server/routes/sync.js` — endpoint flush-stale-logs
- `electron/package.json` — versão

## Resultado

- Backlog atual de 465 logs é limpo automaticamente no boot
- Novos logs são enviados em até 5s (sem depender do fast-lane)
- Se ficar offline, ao reconectar tudo sincroniza imediatamente
- Duplicatas nunca mais travam a fila

