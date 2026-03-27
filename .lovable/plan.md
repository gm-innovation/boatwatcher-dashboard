
Objetivo: parar o falso negativo no CI (“dist/index.html NOT found inside app.asar”) e destravar os releases.

Do I know what the issue is?
- Sim.

Diagnóstico confirmado:
- O `app.asar` está sendo encontrado corretamente em `electron-dist/win-unpacked/resources/app.asar`.
- O `npx asar list` no runner Windows imprime caminhos com `\` (backslash), mas a validação atual procura apenas `dist/index.html` com `/`.
- Resultado: o arquivo pode existir como `\dist\index.html`, mas o `grep` falha e derruba o pipeline.

Plano de correção (implementação):

1) Corrigir validação de caminho no passo “Validate Desktop asar contents”
- Arquivo: `.github/workflows/desktop-release.yml`
- No bloco de validação do asar:
  - Capturar saída completa do `npx asar list "$ASAR"` em variável.
  - Normalizar separadores para formato Unix antes do grep:
    - converter `\` -> `/`
    - remover `\r` (CRLF) se necessário.
  - Validar com regex robusta (`(^|/)dist/index\.html$`) após normalização.

2) Melhorar diagnóstico (sem mascarar erro real)
- Ainda no mesmo passo:
  - Exibir as primeiras linhas normalizadas.
  - Se falhar, imprimir linhas que contenham `index.html` e `dist/` para deixar claro se é problema de path, empacotamento ou ausência real do arquivo.

3) Preservar gate de integridade
- Manter bloqueio obrigatório se `dist/index.html` realmente não existir dentro do asar.
- Não relaxar checks de Local Server (exe, tamanho mínimo, SHA512).

4) Verificação final esperada
- Rodar nova tag (`v1.3.16` ou próxima):
  - `Build and publish Desktop release` gera artefatos;
  - `Validate Desktop asar contents` passa com paths normalizados;
  - Pipeline segue para build/upload do Local Server.

Detalhes técnicos:
- Causa raiz é compatibilidade de validação entre separadores de caminho no Windows (`\`) vs regex atual (`/`), não version bump e não horário.
- Arquivo único de ajuste: `.github/workflows/desktop-release.yml`.
