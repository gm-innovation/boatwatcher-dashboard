

## Correção: "Setup native build tools" falhando no CI

### Problema
O step "Setup native build tools" falha com:
```
npm error `msvs_version` is not a valid npm option
```
O comando `npm config set msvs_version 2022` não é mais suportado em versões recentes do npm. O `windows-latest` já vem com Visual Studio Build Tools 2022 pré-instalado, então esse passo é desnecessário.

### Correção
Arquivo: `.github/workflows/desktop-release.yml` (linhas 52-56)

Substituir o step "Setup native build tools" por algo que funcione sem `npm config`:

```yaml
      - name: Setup native build tools
        shell: bash
        run: npx node-gyp install
```

Remove o `npm config set msvs_version 2022` (inválido) e mantém apenas o `node-gyp install`. O runner `windows-latest` já detecta automaticamente o VS Build Tools 2022 via variáveis de ambiente do sistema.

### Resultado esperado
O build #15 da v1.2.8 passará por esse step e continuará até gerar todos os artefatos (Desktop + Local Server).

