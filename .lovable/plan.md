

## Correção: conflito entre `gh` CLI e `electron-builder` na variável `GH_REPO`

### Problema identificado

Na v1.2.11, corrigimos o `gh` CLI mudando `GH_REPO` de `github.event.repository.name` para `github.repository`. Isso resolveu o `gh` mas **quebrou o electron-builder**.

O `gh` CLI espera `OWNER/REPO` (ex: `gm-innovation/boatwatcher-dashboard`).
O electron-builder espera apenas o nome do repo (ex: `boatwatcher-dashboard`).

Ambos leem a mesma env var `GH_REPO`, e os formatos são incompatíveis.

Os arquivos `electron-builder.release.yml` e `electron-builder.release.server.yml` usam `${env.GH_REPO}` no campo `repo:`, que agora recebe `gm-innovation/boatwatcher-dashboard` — valor inválido para electron-builder.

### Correção

Criar uma variável separada para cada ferramenta:

**`.github/workflows/desktop-release.yml`** — adicionar nova env var:
```yaml
env:
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  GH_OWNER: ${{ github.repository_owner }}
  GH_REPO: ${{ github.repository }}                    # OWNER/REPO → para gh CLI
  GH_REPO_NAME: ${{ github.event.repository.name }}    # só nome → para electron-builder
  CSC_IDENTITY_AUTO_DISCOVERY: 'false'
```

**`electron-builder.release.yml`** — usar a nova variável:
```yaml
publish:
  provider: github
  owner: ${env.GH_OWNER}
  repo: ${env.GH_REPO_NAME}    # era GH_REPO
```

**`electron-builder.release.server.yml`** — mesma alteração:
```yaml
publish:
  provider: github
  owner: ${env.GH_OWNER}
  repo: ${env.GH_REPO_NAME}    # era GH_REPO
```

**`package.json`** — bump para `1.2.13` para ciclo limpo.

### Resultado esperado
- `electron-builder --publish always` usa `GH_REPO_NAME` (só o nome) → publica Desktop corretamente
- `gh release upload` usa `GH_REPO` (OWNER/REPO) → faz upload do Local Server corretamente
- Todos os artefatos (Desktop + Local Server) publicados na release `v1.2.13`

