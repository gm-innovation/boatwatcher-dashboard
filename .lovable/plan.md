

## Correções finais — Local Server

O servidor **já está funcionando**. Restam dois ajustes simples:

### 1. Impedir segunda instância de executar `whenReady`

**Arquivo**: `electron/local-server-main.js` (linhas 63-67)

O `app.quit()` não impede o callback de `whenReady` de executar. Solução: adicionar uma flag `let isSecondInstance = false` e checar no `whenReady`.

```javascript
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  logToFile('Another instance is already running — quitting');
  app.quit();
  // app.quit() é assíncrono — marcar flag para impedir whenReady
}
const isSecondInstance = !singleInstanceLock;
```

No `whenReady`:
```javascript
app.whenReady().then(async () => {
  if (isSecondInstance) return; // não fazer nada
  // ... resto do boot
});
```

### 2. Corrigir nome do app (userData mostra "vite_react_shadcn_ts")

**Arquivo**: `electron/local-server-main.js` — adicionar no topo, antes de qualquer uso de `app.getPath`:

```javascript
app.setName('Dock Check Local Server');
```

Isso faz o `userData` apontar para `%APPDATA%/Dock Check Local Server/` em vez de `vite_react_shadcn_ts`.

### Resultado esperado
- Instância duplicada não tenta abrir porta
- Logs ficam em `%APPDATA%/Dock Check Local Server/error.log`
- Servidor continua funcionando normalmente na porta 3001

