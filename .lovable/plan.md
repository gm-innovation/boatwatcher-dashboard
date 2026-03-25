

## Bump para v1.2.15

A tag `v1.2.14` já foi usada no GitHub (mesmo deletada, pode causar conflitos com caches do GitHub Releases). A solução é pular para `v1.2.15`.

### Alteração

**`package.json`**: `"version": "1.2.14"` → `"1.2.15"`

Após o commit, criar a tag `v1.2.15` no GitHub para disparar o CI e gerar o instalador com todas as correções (versão dinâmica na UI, polling 5s, execução paralela).

