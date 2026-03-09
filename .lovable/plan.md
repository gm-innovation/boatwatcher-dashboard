

# Revisao Final — Pendencias Restantes

## CORRECOES NECESSARIAS

### 1. Double MainLayout (Bug de Layout)
**Severidade: ALTA** — `ProtectedRoute.tsx` (linha 22) envolve children em `<MainLayout>`, e `App.tsx` TAMBEM envolve cada rota em `<MainLayout>`. Resultado: **dois headers, dois ProjectProviders, padding duplicado**. Toda rota protegida renderiza o layout duas vezes.

**Correcao:** Remover o `<MainLayout>` de dentro do `ProtectedRoute.tsx` — deixar apenas a logica de auth. Os wraps em `App.tsx` ja cuidam do layout.

### 2. Cron Job nunca foi criado
**Severidade: ALTA** — A migration anterior habilitou `pg_cron` e `pg_net`, mas o `cron.schedule()` que agenda a execucao diaria de `check-expiring-documents` **nunca foi executado**. Precisa de nova migration com o schedule real.

### 3. Storage buckets sao todos publicos
**Severidade: MEDIA** — Os buckets `worker-photos`, `worker-documents`, `company-documents` e `company-logos` foram criados com `public = true`. Fotos e documentos de trabalhadores nao deveriam ser publicamente acessiveis — qualquer pessoa com a URL pode acessar.

**Correcao:** Tornar `worker-photos` e `worker-documents` privados (`public = false`) e usar URLs assinadas (signed URLs) no frontend. Os buckets `company-logos` podem permanecer publicos.

### 4. Sidebar nao mostra "Visitantes" para company_admin
**Severidade: BAIXA** — O menu "Visitantes" aparece no `mainNavItems` (visivel para todos), mas company_admins so veem Dashboard, Relatorios, Visitantes e Portal da Empresa. Verificar se isso e o comportamento desejado ou se visitantes deveria ser admin-only.

## MELHORIAS

### 5. Admin route sem verificacao de role
O `ProtectedRoute` so verifica se o usuario esta logado. Nao verifica se ele e admin antes de acessar `/admin/*`. Qualquer usuario autenticado pode acessar a area administrativa pela URL diretamente.

**Correcao:** Adicionar prop `requiredRole` ao `ProtectedRoute` e verificar no `App.tsx`:
```
<ProtectedRoute requiredRole="admin">
  <Admin />
</ProtectedRoute>
```

### 6. Sidebar carrega role via fetch separado
Tanto `useAuth` quanto `AppSidebar` fazem queries separadas para buscar o role do usuario. Duplicacao de requests. Melhor centralizar no `useAuth` e passar via contexto.

## ORDEM DE EXECUCAO

| Passo | Item | Esforco |
|-------|------|---------|
| 1 | Fix double MainLayout | Baixo |
| 2 | Adicionar role check ao ProtectedRoute | Baixo |
| 3 | Criar cron job migration | Baixo |
| 4 | Tornar buckets privados + signed URLs | Medio |
| 5 | Centralizar role no useAuth (remover fetch duplicado no sidebar) | Medio |

