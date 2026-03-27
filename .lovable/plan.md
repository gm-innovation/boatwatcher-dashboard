

# Investigação: Desktop v1.3.10 — ERR_FILE_NOT_FOUND (code -6)

## Diagnóstico atual

A correção do CI (build explícito do Vite antes da validação) já estava presente quando v1.3.10 foi publicada. Portanto, o `dist/index.html` **foi incluso no pacote**. O problema é no **runtime**, não no build.

### Causa provável: path resolution no app empacotado

O `electron/main.js` carrega assim:
```js
mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
```

No app empacotado, `__dirname` = `resources/app.asar/electron/`. O path resolve para `resources/app.asar/dist/index.html`. Se o asar estiver corrompido, incompleto, ou o electron-builder reorganizar os arquivos, o `loadFile` falha com `ERR_FILE_NOT_FOUND`.

**Problema secundário**: O handler `did-fail-load` descarta o `validatedURL`, dificultando o diagnóstico:
```js
loadFallback(`Falha ao carregar: ${errorDescription} (código ${errorCode})`);
// ↑ NÃO inclui a URL que falhou!
```

## Plano — Diagnóstico + Hardening

### 1. Adicionar verificação de existência do arquivo antes de `loadFile` (`electron/main.js`)

Antes de chamar `loadFile`, verificar se o path existe dentro do asar usando `fs.existsSync`. Se não existir, logar o caminho exato e a listagem do diretório pai, depois carregar o fallback com informação útil.

```js
const indexPath = path.join(__dirname, '../dist/index.html');
appendLog(`Attempting to load: ${indexPath}`);
appendLog(`File exists: ${fs.existsSync(indexPath)}`);

// Listar o que existe no diretório pai para diagnóstico
try {
  const parentDir = path.join(__dirname, '..');
  const contents = fs.readdirSync(parentDir);
  appendLog(`App root contents: ${contents.join(', ')}`);
} catch (e) {
  appendLog(`Cannot list app root: ${e.message}`);
}
```

### 2. Incluir `validatedURL` no fallback error (`electron/main.js`)

Alterar o `did-fail-load` handler para incluir a URL que falhou:
```js
loadFallback(`Falha ao carregar: ${errorDescription} (código ${errorCode}) | URL: ${validatedURL}`);
```

### 3. Adicionar validação do asar no CI (`.github/workflows/desktop-release.yml`)

Depois do step de build do Desktop, extrair e verificar o conteúdo do asar antes de publicar:
```yaml
- name: Validate Desktop asar contents
  shell: bash
  run: |
    ASAR=$(find electron-dist -name 'app.asar' -type f | head -1)
    if [ -z "$ASAR" ]; then
      echo "::error::app.asar not found in electron-dist!"
      exit 1
    fi
    npx asar list "$ASAR" | head -50
    if ! npx asar list "$ASAR" | grep -q 'dist/index.html'; then
      echo "::error::dist/index.html NOT found inside app.asar!"
      exit 1
    fi
    echo "✅ dist/index.html confirmed inside app.asar"
```

### 4. Bump de versão

`package.json`: `"1.3.10"` → `"1.3.11"`

## Arquivos impactados

| Arquivo | Alteração |
|---|---|
| `electron/main.js` | Diagnóstico de path + URL no fallback |
| `.github/workflows/desktop-release.yml` | Validação do asar após build |
| `package.json` | Versão → 1.3.11 |

## Resultado esperado

Se o problema persistir na v1.3.11, o arquivo `renderer-errors.log` na máquina do usuário conterá o caminho exato que falhou e a listagem do diretório do app, permitindo identificar definitivamente se é path resolution, asar corrompido, ou outro fator.

