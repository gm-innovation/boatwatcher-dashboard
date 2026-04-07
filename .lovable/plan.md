

## Diagnóstico: Timestamps 3h atrasados

### Causa raiz

A função `normalizeTimestamp` em `electron/agent.js` trata timestamps numéricos (Unix epoch) **sem aplicar o offset de +3h** (linha 48-50):

```javascript
if (typeof raw === 'number') {
  return new Date(raw * 1000).toISOString(); // ← SEM +3h
}
```

Os dispositivos ControlID no Brasil têm o relógio configurado em BRT, mas o firmware gera o epoch a partir do horário local (como se fosse UTC). O resultado: o valor armazenado no banco é BRT rotulado como UTC. Quando o front-end converte UTC→BRT para exibição, subtrai mais 3h → **timestamp aparece 3h no passado**.

Evidência do banco:
```
timestamp:  2026-04-07 17:22:39+00  (deveria ser 20:22:39+00)
created_at: 2026-04-07 20:24:09+00  (auto-gerado, correto)
```
Diferença: exatamente 3h.

A rota de strings sem timezone (linha 60-66) já aplica +3h corretamente. Apenas o caminho numérico está incorreto.

### Correção

**Arquivo:** `electron/agent.js`

Alterar a branch numérica de `normalizeTimestamp` para adicionar +3h, igual à branch de strings:

```javascript
if (typeof raw === 'number') {
  // ControlID firmware computes epoch from BRT wall clock.
  // Add 3h to convert to true UTC.
  return new Date(raw * 1000 + 3 * 3600 * 1000).toISOString();
}
```

Atualizar o comentário no topo da função para refletir a nova lógica.

### Impacto

- **Novos eventos**: serão armazenados com UTC correto a partir da próxima release do servidor local.
- **Eventos existentes**: já estão no banco com 3h a menos. Não serão corrigidos retroativamente (seria necessário um script de migração específico).
- **Exibição**: o código de display (`format(new Date(...), 'HH:mm')`) está correto — ele converte UTC→local, o que funcionará assim que os dados estiverem corretos.

### Arquivos alterados
- `electron/agent.js` — uma única alteração na função `normalizeTimestamp`

### Necessidade de nova release
Sim — como a correção é no agente local (código Electron/Node), requer gerar uma nova build do Local Server. Os dados novos passarão a ter timestamps corretos imediatamente após a atualização.

