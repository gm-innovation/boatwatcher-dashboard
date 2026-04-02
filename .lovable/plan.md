

## Corrigir abertura do PDF de etiquetas (bloqueado pelo navegador)

### Problema
O `window.open(blobUrl)` está sendo bloqueado pelo Chrome (popup blocker ou extensões de adblock). O erro "ERR_BLOCKED_BY_CLIENT" impede a visualização do PDF.

### Solução
Substituir `window.open()` por download direto usando `doc.save()`, que é mais confiável e não é bloqueado por popup blockers. Alternativamente, criar um link temporário (`<a>` com `target="_blank"`) e clicar programaticamente, que contorna bloqueios de popup por ser iniciado por ação do usuário.

**Arquivo: `src/components/workers/WorkerManagement.tsx`** (linhas ~875-879)

Substituir o bloco `try { window.open(bloburl) }` por:
```typescript
// Criar link temporário para abrir o PDF sem ser bloqueado
const blob = doc.output('blob');
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.target = '_blank';
link.rel = 'noopener';
link.click();
// Fallback: se não abrir, fazer download
setTimeout(() => URL.revokeObjectURL(url), 10000);
```

Se ainda for bloqueado, usar `doc.save('etiquetas.pdf')` como método principal (download direto, nunca bloqueado).

