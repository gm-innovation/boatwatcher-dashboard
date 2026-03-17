

## Correção: `installer.nsh` não encontrado

### Causa
Na configuração NSIS, `include: build/installer.nsh` é resolvido **relativo ao `buildResources`** (que já é `build/`). O electron-builder procura em `build/build/installer.nsh` — que não existe.

### Correção
Arquivo: `electron-builder.server.yml`, linha 48

Mudar:
```yaml
include: build/installer.nsh
```
Para:
```yaml
include: installer.nsh
```

Isso faz o electron-builder resolver corretamente como `build/installer.nsh`.

