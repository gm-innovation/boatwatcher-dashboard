

## Corrigir ordem das abas na Administração

### Alteração única

**`src/pages/Admin.tsx`** — Reordenar o array `tabs` (linhas 30-41):

```
Ordem atual:    Projetos → Clientes → Dispositivos → Usuários → Configurações → Diagnóstico → Auditoria → Conectividade
Ordem desejada: Clientes → Projetos → Dispositivos → Usuários → Conectividade → Diagnóstico → Auditoria → Configurações
```

O `defaultValue` do `Tabs` passará a ser `clients` (primeiro item do array).

