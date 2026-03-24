

## Correção: "Upload Local Server artifacts" falhando com formato inválido

### Problema
O `gh release upload` falha com:
```
expected the "[HOST/]OWNER/REPO" format, got "boatwatcher-dashboard"
```

A variável `GH_REPO` (linha 17) contém apenas o nome do repositorio (`boatwatcher-dashboard`), mas o `gh` CLI espera o formato `OWNER/REPO`. O `gh` usa a env var `GH_REPO` internamente para resolver o repositorio, e quando recebe apenas o nome sem owner, falha.

### Correção
**Arquivo:** `.github/workflows/desktop-release.yml`, linha 17

Mudar de:
```yaml
GH_REPO: ${{ github.event.repository.name }}
```
Para:
```yaml
GH_REPO: ${{ github.repository }}
```

`github.repository` retorna `OWNER/REPO` (ex: `seu-usuario/boatwatcher-dashboard`), que é o formato esperado pelo `gh` CLI.

### Versão
Bump `package.json` para **1.2.12** e criar tag `v1.2.12`.

### Resultado esperado
Todos os steps passam, incluindo upload dos artefatos Local Server e verificação final dos assets na release.

