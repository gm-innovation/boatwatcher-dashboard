

## Diagnóstico: Tela em branco no Login

### Análise

Revisei todos os arquivos criados/editados e não encontrei erros de sintaxe, importações inválidas ou dependências faltando. As dependências `html5-qrcode`, `idb-keyval`, `qrcode.react` e `uuid` estão todas no `package.json` e no `bun.lock`.

A página `/login` **não importa** nenhum componente do módulo de controle de acesso — ela é completamente independente. Porém, o `App.tsx` importa `AccessControl` estaticamente, o que significa que **todo o grafo de dependências** (incluindo `html5-qrcode`, `idb-keyval`, `qrcode.react`) é carregado no bundle principal. Se qualquer uma dessas dependências falhar na resolução do módulo no Vite, **toda a aplicação quebra**.

### Causa provável

O módulo `qrcode.react` ou `idb-keyval` pode não ter sido instalado corretamente no sandbox (o `bun.lock` tem a entrada mas o `node_modules` pode estar incompleto). Isso geraria um erro de compilação do Vite que impediria o bundle inteiro de carregar.

### Plano de correção

1. **Forçar reinstalação** das dependências (o sistema faz isso automaticamente ao editar `package.json`)
2. **Como medida de segurança**: adicionar lazy loading para a rota `/access-control` no `App.tsx` — isso isola o módulo e suas dependências pesadas (`html5-qrcode`, `qrcode.react`, `idb-keyval`) do bundle principal, evitando que um erro nesse módulo quebre o login e outras páginas

**Alteração em `App.tsx`:**
```tsx
// Trocar import estático por lazy
const AccessControl = React.lazy(() => import('./pages/AccessControl'));

// Na rota, envolver com Suspense
<Route path="/access-control" element={
  <ProtectedPage requiredRole={['admin', 'operator']}>
    <React.Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
      <AccessControl />
    </React.Suspense>
  </ProtectedPage>
} />
```

3. **Garantir que `BadgePrinter.tsx`** também não quebre o bundle — o import de `qrcode.react` ali é usado condicionalmente dentro de `handlePrint`, mas o import estático no topo do arquivo pode travar o módulo inteiro. Mover para `import()` dinâmico dentro da função.

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Lazy load da rota `/access-control` |
| `src/components/workers/BadgePrinter.tsx` | Import dinâmico de `qrcode.react` dentro de `handlePrint` |

