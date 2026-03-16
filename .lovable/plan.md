
Objetivo: corrigir o modo Desktop para que ele reflita melhor o comportamento esperado sem quebrar a arquitetura offline-first atual.

O que está acontecendo hoje
- O app Desktop abre sem login de propósito:
  - `runtimeProfile.ts` define Electron como `authMode: 'local-bypass'`
  - `useAuth.tsx`, `ProtectedRoute.tsx` e `Login.tsx` pulam autenticação no Desktop
- O Desktop abre “admin” com menos abas de propósito:
  - `src/pages/Admin.tsx` usa uma lista reduzida de abas quando `usesLocalServer()` é true
  - `src/components/layouts/AppSidebar.tsx` também troca “Administração” por “Operação Local” e oculta itens da versão web
- Ele não busca dados da nuvem porque a sincronização local está quebrada:
  1. `electron/sync.js` lê `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `AGENT_TOKEN`
  2. não há carregamento dessas variáveis no servidor local
  3. por isso o sync tenta montar URL vazia e gera `Invalid URL`
  4. além disso há um bug SQLite em `electron/database.js`:
     - `datetime("now")` foi escrito com aspas duplas
     - no SQLite isso vira identificador/coluna, não literal
     - por isso aparece `no such column: "now"`

Plano de implementação
1. Corrigir a sincronização do Desktop
- Fazer o servidor local carregar corretamente as variáveis do ambiente desktop/sync.
- Aceitar como fonte:
  - `VITE_SUPABASE_URL` → mapear para `SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` → mapear para `SUPABASE_ANON_KEY`
  - `AGENT_TOKEN` separado para o agente local
- Adicionar fallback seguro: se faltar configuração, o app deve continuar abrindo em modo offline sem estourar erro no console.

2. Corrigir o bug do SQLite
- Trocar `datetime("now")` por `datetime('now')` em `electron/database.js`.
- Revisar rapidamente outras ocorrências semelhantes no módulo local.

3. Melhorar o comportamento quando não houver credenciais de sync
- Em vez de falhar silenciosamente com `Invalid URL`, o status de conectividade deve mostrar algo como:
  - “Offline local”
  - “Sincronização não configurada”
- Isso evita a impressão de que o banco “não funciona”.

4. Alinhar a experiência de autenticação com a expectativa do produto
- Hoje o Desktop usa bypass total de login.
- Implementar uma decisão explícita de produto para um destes caminhos:
  - manter bypass local e deixar isso claro na interface
  - exigir login no Desktop também
  - permitir modo híbrido: entra sem login para operação local, mas exige login para sincronização/recursos cloud
- Pela arquitetura atual, o caminho menos arriscado é o híbrido.

5. Revisar quais abas admin devem aparecer no Desktop
- Hoje a redução de abas é intencional e feita em:
  - `src/pages/Admin.tsx`
  - `src/components/layouts/AppSidebar.tsx`
- Vou alinhar isso com a sua expectativa:
  - se o Desktop deve ser “operação local”, mantemos abas locais
  - se ele deve parecer igual ao web admin, expandimos as abas e tratamos as que dependem da nuvem com estados apropriados

Arquivos envolvidos
- `electron/sync.js`
- `electron/database.js`
- `server/index.js`
- possivelmente `electron/main.js`
- `src/lib/runtimeProfile.ts`
- `src/hooks/useAuth.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/Login.tsx`
- `src/pages/Admin.tsx`
- `src/components/layouts/AppSidebar.tsx`

Impacto esperado
- O Desktop continuará abrindo.
- A sincronização deixará de falhar por configuração inválida.
- Os dados começarão a baixar quando as credenciais do agente estiverem presentes.
- A interface ficará coerente com o modo Desktop escolhido.
- As abas administrativas poderão ser ajustadas para bater com o que você espera ver.

Detalhe técnico
```text
Hoje:
Electron -> local auth bypass -> local SQLite -> sync quebrado

Depois:
Electron -> local auth ou híbrido -> local SQLite -> sync configurável e resiliente
```

Decisão que precisa ser confirmada antes da implementação
Escolher o comportamento desejado para o Desktop:
1. Desktop operacional local sem login, com sincronização opcional
2. Desktop com login obrigatório igual ao web
3. Desktop híbrido: abre local sem login, mas exige autenticação para sincronizar e liberar abas cloud

Minha recomendação
- Implementar a opção 3.
- Ela preserva o funcionamento offline/local que já existe e resolve sua percepção de “abre direto mas não carrega dados”.
