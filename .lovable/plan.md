
Objetivo

Fazer o Desktop carregar os mesmos clientes e projetos já existentes no sistema web, em vez de mostrar o banco local vazio.

Diagnóstico

O problema não é mais de instalação nem de tela branca. O Desktop está abrindo, mas está lendo a base local SQLite, enquanto a sincronização com a nuvem não está ativa.

Evidências no código e na interface:
- no Desktop, os hooks usam `usesLocalServer()` e passam a buscar dados via `localServerProvider`
- `ProjectContext` e `useDataProvider` leem `/api/projects` e `/api/companies` do servidor local
- o servidor local consulta somente o SQLite local
- o motor de sync (`electron/sync.js`) só sincroniza se existir:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `AGENT_TOKEN`
- sem `AGENT_TOKEN`, o status vira `local-only`
- a própria UI mostra `Sync não configurado`, confirmando que o Desktop não está baixando nada da nuvem

Por isso acontece este comportamento:
```text
Web -> lê backend cloud -> mostra “Skandi Botafogo”
Desktop -> lê SQLite local vazio -> mostra zero projetos e zero clientes
```

Causa raiz

Hoje o Desktop depende de uma configuração de agente/sincronização que não está sendo provisionada automaticamente no app instalado. O login do usuário existe, mas ele não é usado para hidratar o banco local nem para configurar a sincronização inicial.

Plano de correção

1. Implementar bootstrap automático da sincronização no Desktop
- Ao fazer login no Desktop, o app deve verificar se o servidor local está “local-only”.
- Se estiver, o app deve iniciar uma configuração automática para o usuário autenticado, sem depender de configuração manual de token.

2. Criar um fluxo de “primeira sincronização” para a estação
- Buscar ou criar um registro de agente local vinculado ao projeto/estação.
- Persistir com segurança a credencial/token necessária no ambiente/configuração local do Desktop.
- Acionar imediatamente o download inicial de:
  - empresas
  - vínculos usuário-empresa
  - projetos
  - trabalhadores
  - documentos necessários para operação local

3. Adicionar fallback explícito para dados vazios
- Enquanto a sincronização inicial não termina, mostrar estado claro de “sincronizando dados”.
- Evitar a experiência atual de lista vazia que parece erro funcional.
- Se a sync falhar, exibir motivo real na UI.

4. Ajustar a lógica de contexto de projetos
- Depois do bootstrap, recarregar `ProjectContext` e queries relacionadas.
- Garantir que o filtro por empresa do usuário continue funcionando no Desktop usando `user_companies` sincronizado localmente.

5. Melhorar observabilidade do Desktop
- Expor no painel/status:
  - se a estação está configurada
  - hora da última sync
  - quantidade de registros baixados
  - erro de configuração/token, se houver

Arquivos que eu revisaria na implementação

- `electron/sync.js`
- `electron/main.js`
- `server/index.js`
- `src/contexts/ProjectContext.tsx`
- `src/hooks/useDataProvider.ts`
- `src/hooks/useAuth.tsx`
- `src/components/Header.tsx`
- possivelmente um novo util/serviço para bootstrap da sync do Desktop

Abordagem recomendada

A melhor correção é manter o Desktop offline-first, mas com provisionamento automático da sincronização após login. Isso preserva a arquitetura atual e elimina a necessidade de configurar manualmente `AGENT_TOKEN` para cada instalação.

Resultado esperado

Após a implementação:
- ao entrar no Desktop com uma conta válida, o app configura a sync local automaticamente
- o SQLite local é preenchido com os dados já existentes no sistema
- o projeto `Skandi Botafogo` e os clientes vinculados passam a aparecer no Desktop
- o status deixa de ficar como `Sync não configurado`
- o app continua funcionando offline depois da primeira sincronização

Detalhe técnico importante

Hoje o gargalo não parece ser RLS das tabelas principais do sistema web, porque a versão web já enxerga os dados corretamente. O bloqueio está no Desktop não iniciar/configurar a camada de sincronização local, então ele nunca baixa os registros para o banco local.
