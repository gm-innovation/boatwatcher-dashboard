

## Situação

O código corrigido (pipeline CI/CD, fallback de erro, canal `server`) já está no branch `main` do GitHub (commit `0e14ff9`), mas o release mais recente ainda é o **v1.2.1**, que foi criado **antes** dessas correções. Portanto o `server.yml` não existe nesse release.

## O que precisa ser feito (fora do Lovable)

### Passo 1 — Criar uma nova tag no GitHub

No terminal local ou via GitHub CLI:

```text
git pull origin main
git tag v1.2.2
git push origin v1.2.2
```

Ou via GitHub UI: **Releases → Draft a new release → Tag: v1.2.2 → Target: main → Publish**.

Isso dispara o workflow `desktop-release.yml` que agora inclui a verificação do `server.yml`.

### Passo 2 — Verificar os artefatos do release v1.2.2

Após o workflow concluir (~5-10 min), confirmar que o release v1.2.2 contém:
- `DockCheck-Local-Server-Setup-1.2.2.exe`
- `server.yml`
- `latest.yml` (Desktop)

### Passo 3 — Instalação manual única

Baixar e instalar o `DockCheck-Local-Server-Setup-1.2.2.exe` manualmente na máquina. A v1.0.0 não consegue atualizar automaticamente porque não conhece o canal `server`.

A partir da v1.2.2, as próximas atualizações serão automáticas.

### Nenhuma alteração de código necessária

Todas as correções já estão no `main`. O único passo é gerar o release.

