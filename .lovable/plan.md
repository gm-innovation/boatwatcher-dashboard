

## Correção: "Verify server.yml integrity" falhando no Windows

### Problema
O build passou por **todos** os steps até falhar em "Verify server.yml integrity" com:
```
grep: -P supports only unibyte and UTF-8 locales
```

A flag `grep -oP` (Perl regex) não funciona corretamente no Git Bash do Windows. A linha problemática é a **154**:
```bash
YML_SHA=$(grep -oP 'sha512:\s*\K\S+' "$SERVER_YML" | head -1)
```

### Correção
Substituir o `grep -oP` por uma alternativa compatível com Windows (usando `sed` ou `awk`):

**Arquivo:** `.github/workflows/desktop-release.yml`, linha 154

De:
```bash
YML_SHA=$(grep -oP 'sha512:\s*\K\S+' "$SERVER_YML" | head -1)
```

Para:
```bash
YML_SHA=$(grep 'sha512:' "$SERVER_YML" | head -1 | sed 's/.*sha512:\s*//' | tr -d '[:space:]')
```

### Versão
Bump `package.json` para **1.2.11** e criar tag `v1.2.11` para um run limpo.

### Resultado esperado
Todos os steps passam, incluindo a verificação de integridade SHA512, e os artefatos Desktop + Local Server são publicados na release.

