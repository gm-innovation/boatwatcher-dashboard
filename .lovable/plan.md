

## Corrigir posicionamento e duração dos toasts

Há dois problemas:

1. **ToastViewport centralizado globalmente** — a classe em `toast.tsx` usa `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`, fazendo TODOS os toasts aparecerem no centro da tela.
2. **TOAST_REMOVE_DELAY = 1.000.000 ms** (~16 min) — os toasts praticamente nunca somem.

### Alterações

**1. `src/components/ui/toast.tsx` (linha 17)**
Restaurar o ToastViewport para a posição padrão (canto inferior direito):
```
"fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"
```

**2. `src/hooks/use-toast.ts` (linha 9)**
Reduzir `TOAST_REMOVE_DELAY` de `1000000` para `5000` (5 segundos), tempo padrão razoável.

**3. `src/pages/AccessControl.tsx` — toasts de entrada/saída**
Estes já usam `dismiss()` com timeout de 1.2s e ficam centralizados via classes CSS inline no próprio toast. Nenhuma alteração necessária — o comportamento centralizado do módulo de acesso manual é controlado localmente ali, não pelo Viewport global.

Se o toast de entrada/saída do acesso manual não estiver usando estilização centralizada própria, adicionaremos `className` com posicionamento central apenas nessas chamadas específicas.

### Resultado
- Toasts gerais: canto inferior direito, somem em 5s
- Toasts do módulo de acesso manual: continuam centralizados e com dismiss automático de 1.2s

