
Objetivo: corrigir definitivamente o cenário “continua igual” (projetos não sincronizam + dispositivo aparece “somente webhook”) e incluir um fluxo explícito de reinicialização.

1) Diagnóstico de causa raiz (antes de codar)
- Validar na integração local se o processo realmente reinicia: hoje fechar janela não reinicia o serviço (app em bandeja).
- Confirmar checkpoint de sync (`last_download`) e quantidade de registros locais (projects/devices) para detectar “sync parcial marcado como concluído”.
- Confirmar no runtime local se há token, `project_id` vinculado e devices carregados no SQLite local.

2) Corrigir lacuna principal de sincronização de dispositivos
- Arquivo: `electron/sync.js`
- Adicionar etapa de `download-devices` no fluxo padrão de sync (não só no “set token” da UI do servidor local).
- Após baixar devices: persistir no SQLite local via `upsertDeviceFromCloud` e chamar `agentController.reloadDevices()` para refletir imediatamente.
- Resultado esperado: dashboard de conectividade deixa de marcar “somente webhook” quando o vínculo agente-dispositivo já existe no backend.

3) Corrigir robustez do checkpoint de sincronização (projetos sumindo)
- Arquivo: `electron/sync.js`
- Hoje `last_download` é atualizado mesmo quando alguma etapa falha; isso pode “pular” dados para sempre.
- Alterar para estratégia segura:
  - só avançar `last_download` se todas as etapas críticas concluírem sem erro; ou
  - avançar por etapa com checkpoint independente (preferível para resiliência).
- Adicionar log explícito por etapa (companies/projects/devices/workers/docs) para identificar falha real no campo.

4) Implementar reinicialização explícita (pedido do usuário)
- Arquivos: `electron/local-server-main.js`, `electron/server-preload.js`, `electron/server-ui.html`
- Criar ação IPC “reiniciar serviço local”:
  - parar runtime atual (`serverRuntime.stop`)
  - iniciar novamente (`bootLocalServer`)
  - atualizar status na UI.
- Adicionar botão visível “Reiniciar serviço” no painel local.
- Adicionar aviso de UX: “Fechar a janela não encerra/reinicia; o serviço continua na bandeja”.

5) Reinicialização operacional no Desktop (sem depender só da bandeja)
- Arquivos: `src/components/devices/AgentManagement.tsx` e/ou `src/components/admin/DiagnosticsPanel.tsx`
- Adicionar ação “Reiniciar integração local” (sequência: parar agente, iniciar agente, forçar sync).
- Exibir feedback claro (toast + status final).

6) Recovery guiado para estado já corrompido
- Criar ação de manutenção via API local: “Resetar checkpoint e sincronizar completo”.
- Arquivo: `server/routes/sync.js` + `electron/sync.js`
- Implementar endpoint para:
  - resetar `last_download` para epoch
  - executar `triggerSync`
  - retornar resumo (quantos projetos/dispositivos baixados).
- Isso evita depender de fechar/reabrir apps para tentar “forçar” atualização.

7) Higienização de mudança arriscada já versionada
- Arquivo: `supabase/migrations/20260323121835_1a8d320b-9bbe-44ed-826a-76570a3575ec.sql`
- Substituir hardcodes de IDs específicos por abordagem segura de manutenção operacional (sem deletar registros por UUID fixo em migration permanente).
- Manter deduplicação/rebind no fluxo de bootstrap e em endpoint operacional, não em SQL estático de IDs.

8) Validação fim-a-fim (obrigatória)
- Cenário A (Desktop): login → bootstrap → sync inicial → projeto aparece → connectivity mostra device com agente.
- Cenário B (Servidor local UI): inserir token → rebind/download devices → agente inicia → status online.
- Cenário C (falha simulada): interromper uma etapa de download e validar que checkpoint não avança indevidamente.
- Cenário D (reinício): usar novo botão “Reiniciar serviço”, confirmar subida limpa e sincronização após restart.

Detalhes técnicos (resumo de implementação)
- `electron/sync.js`: incluir `downloadDevices()` + checkpoint robusto + logs por etapa.
- `server/routes/sync.js`: novos endpoints de manutenção (`restart`, `reset-and-full-sync`).
- `electron/local-server-main.js`: IPC para restart e chamada de recovery.
- `electron/server-ui.html`: botões “Reiniciar serviço” e “Sync completo”.
- `src/components/...`: ação de restart na UI administrativa do desktop.
- Migração: remover dependência de UUIDs fixos para limpeza de agentes.

Resultado esperado final
- Reinício passa a ser explícito e controlado por botão.
- Sync deixa de perder dados por checkpoint avançado em erro.
- Devices passam a ser baixados no ciclo normal, removendo status “apenas webhook” quando já há vínculo no backend.
- Projetos e conectividade convergem de forma estável após restart/sync completo.
