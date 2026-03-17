
Objetivo: implementar um modo híbrido no Desktop com fallback automático para a nuvem quando o servidor local não estiver disponível, cobrindo leitura e edição.

O que descobri
- Hoje o Desktop entra em `local-server` só por detectar Electron (`runtimeProfile.ts`), sem verificar se o servidor local realmente responde.
- Quase toda a camada de dados usa `usesLocalServer()` para decidir entre servidor local e nuvem (`useDataProvider.ts`, `ProjectContext.tsx`, hooks de dispositivos/agentes/tokens/diagnóstico).
- O servidor local já tem um health check (`localHealth.check()`), então dá para usar isso como chave de decisão.
- O login e a sessão em nuvem já funcionam no Desktop; o problema é a escolha rígida do provider.

Estratégia aprovada
- Desktop com fallback em nuvem.
- O app deve preferir servidor local quando estiver saudável.
- Se o servidor local falhar, o app usa a nuvem automaticamente para leitura e edição.
- Recursos estritamente locais (agente local, ações diretas em hardware, status do servidor local) ficam desabilitados com mensagem clara.

Plano de implementação

1. Criar detecção real do modo de dados
- Substituir a decisão “Electron = local-server” por um estado real de conectividade do servidor local.
- Centralizar isso num util/contexto de runtime para expor algo como:
  - `isDesktop`
  - `localServerAvailable`
  - `dataMode: 'local-server' | 'cloud'`
  - `fallbackActive`
- Fazer cache curto do health check para evitar múltiplos requests redundantes.

2. Adaptar a camada de dados para provider híbrido
- Atualizar `useDataProvider.ts` para usar uma função de decisão dinâmica em vez de `usesLocalServer()` puro.
- Aplicar isso em:
  - companies
  - projects
  - workers
  - worker/company documents
  - access logs
  - devices
  - job functions
- Como o usuário escolheu “leitura e edição”, mutações também devem cair na nuvem quando o local estiver indisponível.

3. Ajustar contextos principais
- Revisar `ProjectContext.tsx` para buscar projetos e empresa atual pelo provider híbrido.
- Garantir recarga automática quando o modo mudar de local para nuvem ou vice-versa.
- Manter o filtro por empresa/role igual ao web.

4. Atualizar hooks que hoje assumem runtime local
- Revisar hooks que bloqueiam ou desviam comportamento com base em `usesLocalServer()`:
  - `useLocalAgents.ts`
  - `useControlID.ts`
  - `useDeviceTokens.ts`
  - `useJobFunctions.ts`
  - outros hooks similares encontrados na busca
- Separar claramente:
  - dados gerais do sistema: podem usar fallback em nuvem
  - operações dependentes de hardware/local server: continuam locais e podem ser desabilitadas

5. Melhorar feedback visual no Desktop
- Atualizar `Header.tsx` para mostrar estados explícitos:
  - Servidor local online
  - Fallback em nuvem ativo
  - Offline sem servidor local
- Em vez de “Sync não configurado” genérico, mostrar o motivo real do modo atual.

6. Tratar tela de agentes e diagnósticos
- `AgentManagement.tsx`:
  - se fallback em nuvem estiver ativo, não tentar iniciar/parar agente local
  - exibir aviso “Servidor local indisponível; dados estão sendo carregados da nuvem”
- `DiagnosticsPanel.tsx`:
  - mostrar separadamente status do servidor local e status do backend online
  - não tratar runtime desktop como 100% local quando o fallback estiver ativo

7. Preservar autenticação e navegação
- Manter o login atual.
- Garantir que redirecionamentos e validação de sessão continuem funcionando no Desktop com `HashRouter`.
- Evitar qualquer dependência de URL local para decidir provider.

Arquivos principais que eu revisaria
- `src/lib/runtimeProfile.ts`
- `src/lib/localServerProvider.ts`
- `src/hooks/useDataProvider.ts`
- `src/contexts/ProjectContext.tsx`
- `src/hooks/useAuth.tsx`
- `src/components/Header.tsx`
- `src/hooks/useLocalAgents.ts`
- `src/hooks/useControlID.ts`
- `src/hooks/useDeviceTokens.ts`
- `src/components/devices/AgentManagement.tsx`
- `src/components/admin/DiagnosticsPanel.tsx`

Resultado esperado
- No Desktop instalado, clientes e projetos existentes na web passam a aparecer mesmo sem servidor local.
- Cadastros e edições de dados administrativos também funcionam online.
- Ações que realmente dependem do servidor local/hardware não quebram com “Failed to fetch”; ficam bloqueadas com mensagem clara.
- Quando o servidor local existir e responder, o app pode voltar automaticamente ao modo local/offline-first.

Detalhe técnico importante
- Eu trataria isso como “capacidade” em vez de “ambiente”: estar no Desktop não significa automaticamente usar provider local.
- Isso reduz regressões e evita repetir o problema em outras telas além de clientes/projetos.
