

## Correção do `require is not defined` no Local Server

### Causa raiz
- O Desktop inclui `electron/**/*` nos files → copia `electron/package.json` (`"type": "commonjs"`) → funciona.
- O servidor local lista arquivos individuais (`electron/local-server-main.js`, `electron/database.js`, etc.) e **não inclui** `electron/package.json`.
- Resultado: o `"type": "module"` do `package.json` raiz prevalece dentro do asar → Node trata `.js` como ESM → `require()` quebra.

### Correção
Adicionar `type: commonjs` em `extraMetadata` no `electron-builder.server.yml`:

```yaml
extraMetadata:
  main: electron/local-server-main.js
  type: commonjs
```

Isso sobrescreve o `type` no `package.json` empacotado sem alterar o arquivo original (que precisa de `"module"` para o Vite).

### Arquivo a editar
- `electron-builder.server.yml` — uma linha adicionada em `extraMetadata`

