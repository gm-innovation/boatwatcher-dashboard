
Objetivo: fechar a versão híbrida Web/Desktop em 2 frentes sequenciais:
1. terminar a operação local funcional sem mensagens provisórias;
2. endurecer sincronização e consistência para ficar pronta para uso contínuo offline.

Plano de execução

1. Fechamento funcional imediato do desktop
- Corrigir `useWorkersOnBoard` em `src/hooks/useSupabase.ts` para usar `fetchWorkersOnBoard()` da camada compartilhada, removendo o acesso direto a `window.electronAPI`.
- Ajustar `src/components/devices/DeviceManagement.tsx` para:
  - habilitar corretamente ações locais já suportadas;
  - adicionar exclusão local real via provider;
  - exibir resultado de `listUsers` em modal;
  - manter estados de loading/refetch consistentes.
- Padronizar status do agente local em:
  - `src/hooks/useLocalAgents.ts`
  - `src/components/devices/ConnectivityDashboard.tsx`
  - `src/components/admin/DiagnosticsPanel.tsx`
  usando uma mesma regra de “online/offline”, sem depender de `last_seen_at` nulo no pseudo-agente.
- Ligar `src/components/admin/DocumentExpirationCheck.tsx` ao servidor local usando os dados já disponíveis de documentos vencidos/a vencer, removendo os textos “próxima fase”.

2. Enrollment local real de trabalhadores em dispositivos
- Substituir o stub `localControlId.enrollWorker()` por fluxo real no servidor local.
- Criar/ajustar rota local para enrollment/remoção em lote, recebendo `workerId`, `deviceIds` e ação.
- No servidor local:
  - carregar trabalhador, foto e dados necessários;
  - chamar as APIs do dispositivo para cadastrar/remover usuário;
  - atualizar `devices_enrolled` no banco local;
  - retornar resultado por dispositivo, com sucesso/falha detalhado.
- Integrar esse fluxo ao hook `useWorkerEnrollment` sem alterar a interface atual da UI.
- Tratar fallback claro para foto ausente, credenciais inválidas e dispositivo offline.

3. Completar CRUD e operação local de dispositivos
- Adicionar `delete` ao `localServerProvider` e à rota local de dispositivos.
- Revisar edição/configuração local para garantir que IP, credenciais, agente e configuração persistam corretamente.
- Garantir que o agente recarregue dispositivos após criação/edição/remoção, sem exigir restart manual do app.

4. Endurecimento da sincronização bidirecional
- Expandir o motor local para sincronizar:
  - `user_companies`
  - `company_documents`
  - `worker_documents`
  - opcionalmente `devices` se o desktop for origem autorizada dessas alterações.
- Adicionar no banco local mecanismos explícitos de sincronização para documentos/relacionamentos:
  - itens pendentes de upload;
  - marcação de sincronizado;
  - suporte a remoções propagáveis.
- Importante: para exclusões sincronizáveis, evitar depender só de hard delete local; usar tombstone/flag de remoção ou fila de operações.
- Expandir as rotas/funções de backend já usadas pelo sync para upload/download incremental dessas entidades.
- Definir regra de conflito:
  - cadastros de referência: backend prevalece;
  - alterações locais pendentes: enviar primeiro;
  - documentos: decidir por `updated_at` mais recente ou por origem prioritária.

5. Limpeza final de acoplamentos e mensagens provisórias
- Revisar buscas por:
  - `window.electronAPI`
  - `isElectron()`
  - textos “próxima fase”, “disponível em breve”, “integração completa”
- Migrar os pontos restantes para `runtimeProfile`, `useDataProvider` e `localServerProvider`.
- Revisar `useDeviceTokens.ts` e outras telas administrativas para decidir se:
  - ficam escondidas no desktop;
  - ou recebem implementação local real.

Arquivos principais envolvidos
- Frontend:
  - `src/hooks/useSupabase.ts`
  - `src/hooks/useLocalAgents.ts`
  - `src/hooks/useControlID.ts`
  - `src/components/devices/DeviceManagement.tsx`
  - `src/components/devices/ConnectivityDashboard.tsx`
  - `src/components/admin/DiagnosticsPanel.tsx`
  - `src/components/admin/DocumentExpirationCheck.tsx`
  - `src/lib/localServerProvider.ts`
  - `src/hooks/useDataProvider.ts`
- Servidor local / desktop:
  - `server/routes/devices.js`
  - `server/routes/workers.js`
  - `server/routes/sync.js`
  - `electron/database.js`
  - `electron/agent.js`
  - `electron/sync.js`

Decisões de implementação
- “Finalizar” será tratado em fases: primeiro fechar operação local; depois robustez de sincronização.
- Enrollment local entra agora, não depois.
- Não parece necessário mudar autenticação nem papéis para esta etapa.
- Mudanças estruturais no backend só devem acontecer se forem realmente necessárias para sincronização de exclusões ou novos contratos incrementais.

Riscos a endereçar
- Exclusão offline sem tombstone pode quebrar a consistência do sync.
- Enrollment depende de foto acessível e compatibilidade do payload com o hardware.
- Status local do agente hoje pode divergir entre telas se não houver uma regra central única.

Critério de pronto
- Desktop consegue:
  - listar, editar, excluir e operar dispositivos localmente;
  - executar enrollment/remoção real de trabalhador;
  - consultar documentos vencidos/a vencer localmente;
  - mostrar status consistente de agente e conectividade;
  - operar sem mensagens de funcionalidade “pendente”.
- Sincronização consegue:
  - subir e baixar documentos/relacionamentos relevantes;
  - reenviar pendências;
  - sobreviver a perda e retorno de internet sem duplicação evidente.

Ordem recomendada
```text
Fase 1
  Corrigir useWorkersOnBoard
  Corrigir DeviceManagement local
  Padronizar status do agente
  Ligar DocumentExpirationCheck ao servidor local

Fase 2
  Implementar enrollment local real
  Completar delete/edição/config local de dispositivos
  Recarregar agente automaticamente após mudanças

Fase 3
  Expandir sync para documents + user_companies
  Implementar tombstones/fila para remoções
  Fechar conflitos, retries e marcação de sync

Fase 4
  Revisão final de acoplamentos restantes
  Remoção de mensagens provisórias
  Validação end-to-end web + desktop + offline + ressincronização
```

Resultado esperado
- Após Fases 1 e 2, a operação local fica funcional de ponta a ponta.
- Após Fase 3, o desktop passa de “funciona localmente” para “opera com segurança e consistência em ambiente offline-first”.
