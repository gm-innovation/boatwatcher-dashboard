

## Diagnóstico

O erro "FOREIGN KEY constraint failed" ocorre em `reconstructWorkersFromSnapshot()` (database.js linha 700). Quando o resync tenta deletar trabalhadores locais que não estão no snapshot da nuvem, o SQLite bloqueia porque:

1. `access_logs.worker_id` referencia `workers(id)` (FK na linha 185)
2. `worker_documents.worker_id` referencia `workers(id)` (FK na linha 167)

E `foreign_keys = ON` está ativo (linha 68).

O `sanitizeWorkers()` tem o mesmo problema (linha 608).

## Plano de Correção

### 1. Corrigir `reconstructWorkersFromSnapshot()` em `electron/database.js`

Antes de deletar um worker, remover as dependências:
- Deletar `worker_documents` do worker sendo removido
- Setar `worker_id = NULL` nos `access_logs` (preservar os logs, só desassociar)

```javascript
// Antes de: db.prepare('DELETE FROM workers WHERE id = ?').run(local.id);
// Adicionar:
db.prepare('DELETE FROM worker_documents WHERE worker_id = ?').run(local.id);
db.prepare('UPDATE access_logs SET worker_id = NULL WHERE worker_id = ?').run(local.id);
db.prepare('DELETE FROM workers WHERE id = ?').run(local.id);
```

### 2. Corrigir `sanitizeWorkers()` em `electron/database.js`

Aplicar a mesma lógica de limpeza de dependências antes de deletar orphans e duplicatas:

```javascript
// Antes de cada: db.prepare('DELETE FROM workers WHERE id = ?').run(orphan.id);
db.prepare('DELETE FROM worker_documents WHERE worker_id = ?').run(orphan.id);
db.prepare('UPDATE access_logs SET worker_id = NULL WHERE worker_id = ?').run(orphan.id);
```

### 3. Bump de versão

Atualizar `package.json` e `server/package.json` para v1.3.26.

### Arquivos alterados
- `electron/database.js` — 3 pontos de deleção de workers precisam de limpeza FK prévia

### Resultado esperado
O "Resync Total" não vai mais falhar com FK constraint. O fluxo completo vai:
1. Baixar snapshot da nuvem (~2.531 workers)
2. Limpar dependências dos workers que serão removidos
3. Reconstruir a tabela local
4. Limpar o dispositivo
5. Recadastrar todos os workers canônicos

