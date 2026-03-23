

## Problema

O `upsertWorkerFromCloud` na linha 1314 de `electron/database.js` **ainda usa o fallback inseguro**:
```javascript
const localCompanyId = resolveLocalEntityId('companies', data.company_id) || data.company_id;
//                                                                          ^^^^^^^^^^^^^^^^
//                                                               Cloud UUID → FK violation silenciosa
```

Quando o worker é inserido com `company_id = UUID-da-nuvem`, o SQLite rejeita por FK constraint. Como o erro ocorre dentro do `try/catch` do sync, ele é engolido silenciosamente — o checkpoint avança, mas o worker nunca é salvo.

Além disso, no `sync.js` (linha 330-331), cada `upsertWorkerFromCloud` não tem try/catch individual — um worker que falha impede o download de todos os seguintes.

## Correções

### 1. FK-safe no `upsertWorkerFromCloud` (`electron/database.js` linha 1314)
Alterar de:
```javascript
const localCompanyId = resolveLocalEntityId('companies', data.company_id) || data.company_id;
```
Para:
```javascript
const localCompanyId = data.company_id ? (resolveLocalEntityId('companies', data.company_id) || null) : null;
if (data.company_id && !localCompanyId) {
  console.warn(`[db] upsertWorkerFromCloud: company not found locally for cloud company_id=${data.company_id}, setting null`);
}
```

### 2. Try/catch individual por worker no sync periódico (`electron/sync.js` linhas 330-334)
Envolver cada iteração do loop de workers com try/catch para que um worker com FK inválido não impeça os demais:
```javascript
for (const worker of workersRes.workers) {
  try {
    this.db.upsertWorkerFromCloud(worker);
    if (worker.photo_signed_url) {
      await this.autoEnrollWorkerPhoto(worker);
    }
  } catch (workerErr) {
    console.error(`[sync] Worker upsert failed for ${worker.id}:`, workerErr.message);
  }
}
```

### Arquivos modificados
- `electron/database.js` — linha 1314: fallback `null` em vez de cloud UUID
- `electron/sync.js` — linhas 330-334: try/catch individual por worker

