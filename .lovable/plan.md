

## Problema

O arquivo `build/installer.nsh` existe no repositório Lovable, mas o `electron-builder` não consegue encontrá-lo no ambiente local. Isso pode ser um problema de sincronização, mas a solução mais robusta é **eliminar a dependência desse arquivo** porque ele não é essencial.

O conteúdo atual do `installer.nsh` faz apenas um `taskkill` antes de desinstalar. Isso pode ser feito nativamente pelo NSIS sem script customizado.

## Correção

**Arquivo**: `electron-builder.server.yml`
- **Remover** a linha `include: installer.nsh` da seção `nsis`
- O `deleteAppDataOnUninstall: true` já cuida da limpeza de dados
- O NSIS já encerra o processo automaticamente quando `oneClick: false` (exibe prompt ao usuário)

Resultado: build passa sem depender de arquivo `.nsh` externo, desinstalação funciona normalmente.

