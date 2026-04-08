
Problema real

- Sim, agora dá para afirmar o problema: o módulo já tem banco local (IndexedDB), mas ele está sendo abastecido com apenas 1000 trabalhadores.
- Em `src/hooks/useOfflineAccessControl.ts` e `src/pages/access-control/AccessControlConfig.tsx`, a busca usa `.limit(5000)`. Isso não vence o limite padrão de 1000 registros por resposta da API.
- O próprio app já tem o padrão correto em `src/hooks/useDataProvider.ts`: paginação com `.range()` em loop. O acesso manual não está usando esse mesmo padrão.
- Como a sincronização atual salva só esse primeiro bloco parcial no cache local, o modo offline também fica incompleto.
- O badge de contagem no header do dispositivo não ajuda o operador e deve sair.

Plano

1. Corrigir a sincronização completa dos trabalhadores
- Substituir a busca única por paginação em lotes de 1000 com `.range(from, to)`.
- Aplicar ordenação determinística por `code` para o conjunto local ficar estável.
- Carregar todos os campos necessários ao manual (`status`, `rejection_reason`, `allowed_project_ids`, etc.).

2. Unificar a lógica de carga e cache
- Centralizar a rotina de “buscar todos os trabalhadores do manual” para reutilizar em:
  - `src/hooks/useOfflineAccessControl.ts`
  - `src/pages/access-control/AccessControlConfig.tsx`
- Salvar no cache/local DB apenas depois de concluir a paginação inteira, evitando cache parcial.

3. Preservar o comportamento offline-first
- Continuar lendo do cache local quando estiver offline.
- Se a sincronização online falhar ou voltar vazia, manter o último dataset local válido.
- Garantir que a tela de configuração e a tela operacional usem exatamente o mesmo escopo de cache.

4. Limpar a interface do dispositivo manual
- Remover o badge de “X trabalhadores” do header em `src/pages/AccessControl.tsx`.
- Simplificar o toast de “Trabalhador não encontrado”, sem mostrar contagem de registros carregados.

Arquivos a alterar
- `src/hooks/useOfflineAccessControl.ts`
- `src/pages/access-control/AccessControlConfig.tsx`
- `src/pages/AccessControl.tsx`
- opcionalmente um helper compartilhado para a paginação dos trabalhadores

Validação esperada
- O banco local passa a receber todos os trabalhadores, não só os primeiros 1000.
- Códigos que hoje ficam fora desse primeiro bloco passam a ser encontrados.
- O manual continua funcionando offline com a última sincronização válida.
- O badge “1000 trabalhadores” desaparece da tela.

Detalhes técnicos
- A raiz do bug não é falta de banco local; é truncamento antes de persistir no banco local.
- `limit(5000)` não resolve quando a API corta a resposta em 1000 linhas; a correção certa é paginação com `range()`.
