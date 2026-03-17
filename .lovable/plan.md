

## Correção do favicon e ícone do Desktop/Servidor Local

### Problema
- O `public/favicon.ico` atual tem resolução menor que 256x256, o que impede o build do Windows.
- O `build/` está vazio — o Desktop (`electron-builder.yml`) já aponta para `build/icon.png` que não existe.
- O servidor local (`electron-builder.server.yml`) aponta para `public/favicon.ico` (pequeno demais).

### O que vou fazer

1. **Copiar `public/favicon-512.png` para `build/icon.png`**
   - Esse é o ícone de 512x512 que já existe no projeto e representa a identidade visual correta.
   - Atende o requisito mínimo de 256x256 do electron-builder no Windows.

2. **Atualizar `electron-builder.server.yml`**
   - Trocar `win.icon` de `public/favicon.ico` para `build/icon.png`.
   - Adicionar `directories.buildResources: build`.
   - Incluir `build/icon.png` na lista de `files`.

3. **Atualizar `electron/local-server-main.js`**
   - Trocar referência do tray icon de `public/favicon.ico` para `public/favicon-512.png` (dev) e caminho empacotado correto (prod).

4. **Atualizar `electron/main.js`**
   - Garantir que `getWindowIconPath()` use `favicon-512.png` consistentemente (já usa, mas confirmar).

### Resultado esperado
- `npm run build:electron` e `npm run build:local-server` passam sem erro de ícone.
- Ícone correto no instalador, atalho da área de trabalho, barra de tarefas e bandeja do sistema.

