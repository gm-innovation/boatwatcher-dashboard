

## Correções para o Build do GitHub Actions

### Problema 1: Versão não foi bumpada
O `package.json` ainda está com `"version": "0.0.0"`. Preciso alterar para `"1.1.0"`.

### Problema 2: Possível falha no `npm ci`
O projeto usa `bun` como gerenciador principal, mas o workflow usa `npm ci`. Se o `package-lock.json` estiver dessincronizado, o `npm ci` falha instantaneamente — explicando os 28-42 segundos de execução.

### Correções

**1. `package.json`** — Bumpar versão para `1.1.0`
```json
"version": "1.1.0"
```

**2. `.github/workflows/desktop-release.yml`** — Trocar `npm ci` por `npm install` para tolerância a lockfile desatualizado, ou regenerar o lockfile antes:
```yaml
- name: Install dependencies
  run: |
    npm install --package-lock-only
    npm ci
```

### Após o commit
Você precisará re-criar a tag:
```powershell
git pull
git tag -d v1.1.0
git push origin :refs/tags/v1.1.0
git tag v1.1.0
git push origin v1.1.0
```

### Diagnóstico pendente
Se possível, envie o screenshot dos logs do workflow falho — pode haver outro erro (ex: dependência nativa `better-sqlite3` falhando no build do Windows).

