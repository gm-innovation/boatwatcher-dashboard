

## Bump para v1.2.17

O `package.json` será atualizado de `"version": "1.2.16"` para `"1.2.17"` para evitar conflitos residuais com a tag v1.2.16 no GitHub.

### Alteração

**`package.json`**: `"version": "1.2.16"` → `"1.2.17"`

### Após o commit

1. Aguardar o commit aparecer no GitHub (verificar na lista de commits)
2. Criar a tag `v1.2.17` **a partir desse commit**
3. O CI deve passar com as correções de `--legacy-peer-deps` já aplicadas

