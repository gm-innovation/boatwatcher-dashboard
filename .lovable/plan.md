

## Corrigir falha de CI: package-lock.json desatualizado

### Problema

O `package-lock.json` no repositório está obsoleto (ainda referencia o nome `vite_react_shadcn_ts` v0.0.0). Quando o CI executa `npm install --package-lock-only`, o npm tenta resolver todas as dependências do zero e encontra um conflito de peer dependencies com `react-dom` nos pacotes `@radix-ui/*`.

### Solução

Adicionar `--legacy-peer-deps` aos dois comandos npm no workflow do CI para ignorar conflitos de peer dependencies (comportamento padrão do bun, que é o gerenciador usado localmente).

### Alteração

**`.github/workflows/desktop-release.yml` linhas 64-67**:

```yaml
      - name: Install dependencies
        run: |
          npm install --package-lock-only --legacy-peer-deps
          npm ci --foreground-scripts --loglevel=verbose --legacy-peer-deps
```

### Após o commit

1. Deletar a tag `v1.2.16` e o release no GitHub
2. Aguardar o commit aparecer no GitHub
3. Recriar a tag `v1.2.16` a partir do novo commit
4. O CI deve passar e gerar o instalador

