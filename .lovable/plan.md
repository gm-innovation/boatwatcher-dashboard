
Diagnóstico

Do I know what the issue is? Sim.

O problema real não é mais “o banco só retorna o Alexandre”. O snapshot de rede mostra que a consulta de `workers` já está retornando vários trabalhadores. O erro persiste porque a lógica atual ainda transforma muitos trabalhadores em “invisíveis” antes da busca:

1. `useOfflineAccessControl.ts` filtra a lista por `allowed_project_ids?.includes(projectId)`.  
   Resultado: quem pertence às empresas do cliente, mas não está autorizado nesse projeto, some da lista e vira “Trabalhador não encontrado” — quando o comportamento correto seria aparecer como bloqueado com motivo.

2. O cache IndexedDB usa uma chave global única (`ac_workers_cache`).  
   A tela de configuração (`AccessControlConfig.tsx`) ainda sincroniza só trabalhadores `active` e pode sobrescrever esse cache com um subconjunto parcial.

3. A tela principal pega `manual_access_points` com `.eq('is_active', true).limit(1)` sem garantir seleção determinística.  
   Se existir mais de um terminal ativo, o app pode carregar o escopo errado.

Plano de implementação

1. Corrigir a regra de visibilidade no acesso manual
- Em `src/hooks/useOfflineAccessControl.ts`, parar de usar o projeto atual para esconder trabalhadores da busca.
- Carregar todos os trabalhadores do escopo do terminal (empresas vinculadas ao cliente do terminal), não apenas os autorizados para aquele projeto.
- Separar “visível no terminal” de “autorizado para entrar/sair”.

2. Derivar status de acesso corretamente
- Para cada trabalhador, calcular no frontend:
  - visível no terminal
  - autorizado no projeto atual
  - motivo de bloqueio exibível
- Regras:
  - `status !== active` => bloqueado pelo status/revisão
  - `status === active`, mas sem autorização no projeto do terminal => bloqueado com motivo como “Não autorizado para este projeto”
  - `status === active` e autorizado => liberado

3. Ajustar a busca e a tela de confirmação
- Em `src/pages/AccessControl.tsx`, buscar pelo código na lista visível completa.
- Quando encontrar trabalhador não autorizado, mostrar o `WorkerCard` com borda vermelha e motivo, sem exibir os botões de entrada/saída.
- Manter “não encontrado” apenas quando o código realmente não existir dentro do escopo do terminal.

4. Corrigir o cache offline para não contaminar resultados
- Em `src/hooks/useOfflineAccessControl.ts`, trocar a chave global por cache segmentado por terminal/client/projeto, ou armazenar o dataset bruto e derivar a lista em memória.
- Em `src/pages/access-control/AccessControlConfig.tsx`, alinhar a sincronização manual com a mesma regra da tela principal:
  - remover `.eq('status', 'active')`
  - não salvar subconjuntos incompatíveis no mesmo cache
  - exibir quantidade sincronizada real do escopo do terminal

5. Endurecer a seleção do terminal ativo
- Revisar a carga de `manual_access_points` em `src/pages/AccessControl.tsx`.
- Garantir que o app use um único terminal ativo de forma determinística, ou falhe de forma explícita se houver mais de um ativo.

6. Ajustar a visibilidade para operadores no backend
- Criar migração de RLS para que `operator` consiga ler apenas o mesmo escopo usado pelo terminal:
  - projetos acessíveis do cliente do operador
  - empresas vinculadas a esses projetos
  - trabalhadores dessas empresas
- Isso mantém o comportamento correto para operador sem abrir acesso global.

Arquivos a alterar
- `src/hooks/useOfflineAccessControl.ts`
- `src/pages/AccessControl.tsx`
- `src/pages/access-control/AccessControlConfig.tsx`
- `src/components/access-control/WorkerCard.tsx`
- `supabase/migrations/...` (nova política RLS para operador e, se necessário, ajuste de escopo de companies/projects)

Validação esperada
- Código do Alexandre continua funcionando.
- Códigos de outros trabalhadores das empresas vinculadas ao cliente passam a ser encontrados.
- Se o trabalhador não estiver autorizado no projeto atual, ele aparece na tela como bloqueado com motivo, em vez de “não encontrado”.
- Offline e sincronização manual passam a refletir o mesmo comportamento da busca online.
