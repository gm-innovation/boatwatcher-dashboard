
Próximos passos recomendados, na ordem mais segura e útil para continuar:

1. Fechar a Fase 1: eliminar acoplamentos restantes ao backend web
- Ainda há vários pontos da UI e dos hooks importando o cliente cloud diretamente.
- Prioridade para:
  - `src/components/dashboard/RecentActivityFeed.tsx`
  - `src/hooks/useControlID.ts`
  - `src/hooks/useWorkerDocuments.ts` (update/delete e consultas de expiração ainda estão só no cloud)
  - telas/admin que ainda fazem operações diretas sem passar pela camada compartilhada
- Objetivo: toda leitura/escrita passar por `runtimeProfile` + `useDataProvider`/`localServerProvider`.

2. Completar a paridade do servidor local para documentos
- Hoje já existem rotas locais de criação/listagem para `company_documents` e `worker_documents`.
- O próximo passo natural é adicionar no servidor local:
  - edição de documento
  - exclusão de documento
  - consultas de vencidos/a vencer
- Isso libera o portal e o admin para funcionarem de forma realmente equivalente no desktop/offline.

3. Padronizar o runtime desktop
- Ainda existem pontos usando `isElectron()` e até `window.electronAPI` diretamente.
- A próxima etapa é trocar isso por decisões centralizadas via:
  - `usesLocalServer()`
  - `usesLocalAuth()`
  - `localServerProvider`
- Benefício: menos lógica espalhada, menos bugs de divergência entre web e desktop.

4. Separar perfis de produto Web x Desktop
- Hoje as rotas e menus continuam muito “misturados”.
- Implementação planejada:
  - esconder/ajustar menus no `AppSidebar`
  - adaptar páginas administrativas (`Admin`, `ProjectSettings`, etc.)
  - bloquear ou redirecionar funcionalidades que só fazem sentido na web
  - destacar claramente as funções operacionais locais no desktop
- Isso deixa a experiência mais coerente e reduz telas “meio suportadas”.

5. Fortalecer os fluxos de dispositivos/agentes
- `useControlID.ts` ainda tem comportamento parcialmente stubado no desktop.
- Próxima fase:
  - ligar ações reais ao servidor local/agente
  - formalizar comandos de start/stop/status
  - alinhar enrollment/sincronização de trabalhadores com o motor local
- Isso é importante para sair do modo “fallback” e entrar em operação real.

6. Endurecer a sincronização bidirecional
- Depois da paridade funcional local, vale consolidar o contrato de sync para:
  - `companies`
  - `user_companies`
  - `company_documents`
  - `worker_documents`
  - comandos para agentes/dispositivos
- Também é a hora de revisar conflitos, timestamps, retries e marcação de itens sincronizados.

7. Só depois: validação funcional completa
- Quando os pontos acima estiverem implementados, a etapa final dessa trilha é validar:
  - web
  - desktop
  - operação sem internet
  - retorno da internet com sincronização
  - portal da empresa
  - dispositivos/agentes

O que eu considero a próxima execução ideal agora:
- Etapa A: migrar os acoplamentos restantes (`RecentActivityFeed`, `useControlID`, `useWorkerDocuments`).
- Etapa B: adicionar update/delete/consultas de expiração no servidor local.
- Etapa C: separar navegação e permissões por perfil Web/Desktop.

Detalhes técnicos observados no código atual
- `RecentActivityFeed` ainda usa `isElectron()` e consulta cloud diretamente no modo web.
- `useControlID.ts` ainda depende de `isElectron/getElectronAPI` e retorna respostas locais simuladas em partes do fluxo.
- `useWorkerDocuments.ts` já suporta create/list no local, mas update/delete e relatórios de expiração continuam no cloud.
- `useWorkersOnBoard` em `useSupabase.ts` ainda consulta `electronAPI.db` em vez de padronizar totalmente pelo servidor local.
- `AppSidebar`, `Admin` e `ProjectSettings` ainda não refletem uma separação clara entre produto web e produto desktop.

Resumo executivo
- A base híbrida já está bem encaminhada.
- O próximo passo não é criar novas features grandes.
- O certo agora é fechar a consistência do runtime, completar a paridade do servidor local e só então separar definitivamente os perfis de produto.

Plano de execução imediato
```text
Fase 1B
  -> Migrar hooks/componentes restantes
  -> Completar CRUD local de documentos
  -> Padronizar runtime checks

Fase 2
  -> Separar menus, rotas e permissões Web/Desktop

Fase 3
  -> Conectar agentes/dispositivos de forma real
  -> Fechar sincronização bidirecional

Fase 4
  -> Teste end-to-end web + desktop + offline + ressincronização
```
