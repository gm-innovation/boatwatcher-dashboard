

## Correção: Tela Branca no Dock Check Desktop

### Causa Raiz
O `package.json` declara `"type": "module"`, mas o `electron/main.js` usa `require()` (CommonJS). Quando o Electron empacotado tenta executar o processo principal, ele falha porque o Node.js interpreta o arquivo como ES Module — resultando na janela em branco.

O build do **Local Server** funciona porque o `electron-builder.server.yml` já contém `extraMetadata: { type: commonjs }`. O build do **Desktop** (`electron-builder.yml`) não tem essa configuração.

### Correção

**Arquivo: `electron-builder.yml`** — Adicionar `extraMetadata` para injetar `type: commonjs` no `package.json` empacotado:

```yaml
extraMetadata:
  type: commonjs
```

### Após o commit
Recriar a tag para disparar o build:
```powershell
git pull
git tag -d v1.1.0
git push origin :refs/tags/v1.1.0
git tag v1.1.0
git push origin v1.1.0
```

O auto-updater do Desktop detectará a nova versão automaticamente.

