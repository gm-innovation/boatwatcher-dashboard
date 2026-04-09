

# Plano de Correção em Fases

Cada fase será testada antes de avançar. Nenhuma alteração em funcionalidades que já estão operando.

---

## Situação Atual Confirmada

**O que funciona:**
- Dashboard mostra entradas manuais corretamente
- Web reports mostram entradas manuais corretamente
- Sync de workers, companies, devices funciona (token `fe25b788` válido)
- BRT utility (`src/utils/brt.ts`) está criado e parcialmente em uso

**O que está quebrado:**
1. **Facial não chega à nuvem** — Agent tem 543 logs não sincronizados com `lastUploadErr=YES`. O token antigo `84ed5d35` (de uma instância obsoleta) está tentando uploads e falhando. O token válido `fe25b788` parece não estar sendo usado para upload-logs.
2. **Relatórios web e desktop divergem** — Desktop usa SQLite (local-first), que não recebeu os logs manuais da nuvem (porque o cursor `download-access-logs` pode estar avançado demais ou porque o upload falhou). Web usa cloud.
3. **Horário errado no relatório web** — Os timestamps faciais antigos na nuvem (dia 08/04) estão corretos em UTC, mas a UI de relatório ainda tem parsing residual de timezone em `Reports.tsx` (`parseISO`/`format`) e nos exports.

---

## Fase 1: Destravar o upload de logs faciais (problema principal)

**Objetivo:** Fazer os 543 logs parados chegarem à nuvem.

**Diagnóstico:** O `uploadLogs()` em `electron/sync.js` usa `this.agentToken` que resolve via `process.env.AGENT_TOKEN || db.getSyncMeta('agent_token')`. Se houver um token antigo em `process.env.AGENT_TOKEN` que o Electron definiu ao iniciar, ele prevalece sobre o do SQLite. O retry de 401 tenta recarregar do DB, mas se o token do DB também estiver errado (ou o env for persistente), o ciclo falha.

**Arquivos a editar:**
- `electron/sync.js` — Forçar `agentToken` a sempre ler do DB primeiro (mais recente e confiável), não do env. Adicionar log claro do token sendo usado em cada upload.

**Teste:** Verificar nos logs da edge function se o upload-logs passa a chegar com o token `fe25b788` e se os logs são inseridos na nuvem. Confirmar no dashboard que eventos faciais aparecem.

---

## Fase 2: Corrigir horários nos relatórios web

**Objetivo:** Relatórios web exibem timestamps corretos em BRT.

**Diagnóstico:** `Reports.tsx` usa `format(parseISO(projectStart), 'yyyy-MM-dd')` que pode deslocar dia dependendo do timezone. Os componentes de relatório já usam `useAccessLogs` que busca da nuvem (cloud path) com limites BRT corretos. O problema residual está na formatação/agrupamento nos componentes.

**Arquivos a editar:**
- `src/pages/Reports.tsx` — Substituir `format(parseISO(...))` por parsing direto de substring `yyyy-MM-dd` (sem timezone)
- `src/components/reports/OvernightControl.tsx` — Verificar se `differenceInCalendarDays` com `parseISO` causa deslocamento; usar `toBrtDate` se necessário
- `src/utils/exportReportPdf.ts` — Confirmar que já usa BRT helpers (foi editado antes)
- `src/utils/exportReports.ts` — Confirmar uso de BRT

**Teste:** Gerar relatório de presença e de trabalhadores no web para o dia 08/04. Confirmar que os horários batem com os timestamps UTC da nuvem convertidos para BRT.

---

## Fase 3: Garantir convergência SQLite ← Nuvem

**Objetivo:** Desktop recebe todos os logs da nuvem (manuais + faciais já enriquecidos).

**Diagnóstico:** O SQLite já tem `updated_at` na tabela. O `downloadAccessLogs` já usa `updated_at` como cursor. O `upsertAccessLogFromCloud` já faz reconciliação por chave canônica. A convergência deveria funcionar se o upload (Fase 1) destravar.

**Verificação:** Após Fase 1, esperar 1 ciclo de sync (60s) e verificar se os mesmos 19+ logs do dia 08/04 aparecem no relatório desktop. Se não aparecerem:
- Investigar se o cursor `last_download_access_logs` está avançado demais
- Verificar se o `download-access-logs` está retornando os logs manuais

**Possível correção:** Reset do cursor `last_download_access_logs` para re-download se necessário.

---

## Fase 4: Corrigir normalizeTimestamp no agente (prevenção)

**Objetivo:** Novos eventos faciais são armazenados com timestamp UTC correto na origem.

**Diagnóstico:** `normalizeTimestamp` no `electron/agent.js` trata strings com timezone como "já corretas" (linha 53-57). Se o dispositivo ControlID enviar timestamp com timezone `+00:00` mas o valor real for BRT (ex: `2026-04-09T10:00:00+00:00` quando na verdade são 10h BRT), o código aceita como UTC e o resultado fica 3h adiantado.

**Arquivo a editar:**
- `electron/agent.js` — Na branch de timestamp com timezone, adicionar heurística: se o offset é +00:00 mas o dispositivo é ControlID (que sempre opera em BRT), tratar como BRT e adicionar +3h. Ou: sempre tratar timestamp de dispositivo como BRT local, independente do marcador.

**Teste:** Registrar entrada facial e verificar no dashboard que o horário exibido corresponde ao horário real (em BRT).

---

## Resumo de impacto por fase

| Fase | Risco | Muda o que funciona? |
|------|-------|---------------------|
| 1 | Baixo — muda apenas prioridade de token no sync | Não |
| 2 | Baixo — muda apenas formatação de texto | Não |
| 3 | Nenhum — apenas verificação e possível reset de cursor | Não |
| 4 | Médio — muda parsing de timestamp na ingestão | Não afeta dados existentes |

