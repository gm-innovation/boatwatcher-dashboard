

## Problema

O build local falha com `cannot expand pattern "${env.GH_OWNER}"` porque o `electron-builder.server.yml` contém um bloco `publish` com variáveis de ambiente (`GH_OWNER`, `GH_REPO`) que só existem no GitHub Actions. Mesmo com `--publish never`, o electron-builder tenta expandir essas variáveis.

## Correção

**`electron-builder.server.yml`** — Remover o bloco `publish` inline. A configuração de publish já existe no arquivo separado `electron-builder.release.yml`, que é usado apenas no CI via o script `build:local-server:publish`.

Isso segue o mesmo padrão do Desktop: o `electron-builder.yml` não tem `publish`, e o release yml é adicionado via `--config` extra apenas no CI.

### Alteração

Remover as linhas 34-39 do `electron-builder.server.yml` (o bloco `publish`).

### Resultado
- Build local (`npm run build:local-server`) funciona sem variáveis de CI
- Build no CI (`npm run build:local-server:publish`) continua funcionando porque já carrega `electron-builder.release.yml` como segundo `--config`

