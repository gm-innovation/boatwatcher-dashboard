

## Correção completa do Local Server + Uninstaller

### Problemas identificados

1. **`cors` ausente** no `package.json` raiz — é o erro atual (`Cannot find module 'cors'`)
2. **`uuid` v13 é ESM-only** — vai crashar assim que o `cors` for resolvido, porque `require('uuid')` não funciona em v13
3. **Sem uninstaller configurado** — o NSIS não está configurado para permitir desinstalação limpa (dados do usuário, serviço, etc.)

### Correções

**1. Adicionar `cors` nas dependencies da raiz**
- Arquivo: `package.json`
- Adicionar `"cors": "^2.8.5"` em `dependencies`

**2. Eliminar `uuid` dos arquivos CJS — usar `crypto.randomUUID()` nativo**
- `electron/database.js` — remover `require('uuid')`, trocar `uuidv4()` por `crypto.randomUUID()`; adicionar `const crypto = require('crypto');`
- `server/routes/storage.js` — mesma substituição

**3. Remover `uuid` do `server/package.json`**
- Já não será usado em nenhum arquivo CJS

**4. Configurar uninstaller no NSIS**
- Arquivo: `electron-builder.server.yml`
- Adicionar configurações NSIS para:
  - Incluir opção de remover dados do usuário (`deleteAppDataOnUninstall`)
  - Garantir que o processo é encerrado antes de desinstalar (`runAfterFinish: false` para evitar reinício)
  - Adicionar `uninstallDisplayName`

**5. Script de verificação pré-build**
- Novo arquivo: `scripts/verify-local-server-deps.cjs`
- Valida que `express`, `cors`, `better-sqlite3` são resolvíveis antes de empacotar
- Adicionar script `prebuild:local-server` no `package.json`

### Arquivos alterados
| Arquivo | Ação |
|---|---|
| `package.json` | Adicionar `cors`, script `prebuild:local-server` |
| `electron/database.js` | `uuid` → `crypto.randomUUID()` |
| `server/routes/storage.js` | `uuid` → `crypto.randomUUID()` |
| `server/package.json` | Remover `uuid` |
| `electron-builder.server.yml` | Configurar NSIS uninstall |
| `scripts/verify-local-server-deps.cjs` | Novo — validação pré-build |

