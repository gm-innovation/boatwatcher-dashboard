

## Bump para v1.2.16

O `package.json` ainda mostra `"version": "1.2.13"` — as edições anteriores (1.2.14 e 1.2.15) não foram salvas corretamente no repositório.

### Alteração

**`package.json` linha 5**: `"version": "1.2.13"` → `"1.2.16"`

### Após o commit

1. Aguardar o commit do Lovable aparecer no GitHub (verificar na lista de commits)
2. Criar a tag `v1.2.16` **a partir desse commit** (não antes)
3. O CI gera `DockCheck-Local-Server-Setup-1.2.16.exe` com todas as correções
4. Instalar por cima no operador — a partir daí, auto-update funciona

