
Diagnóstico objetivo (sem rodeio):
- O erro não é “horário” nem “version bump”.
- O build de release está saindo em `dist/` (ex.: `dist/win-unpacked`) e não em `electron-dist/`.
- Evidência: o log mostra `loaded configuration file=...electron-builder.release.yml` (apenas o arquivo de release foi carregado), então as opções do `electron-builder.yml` (incluindo `directories.output: electron-dist`) não entram.
- Resultado: a etapa de validação procura `electron-dist` e falha, mesmo com build tendo rodado.

Do I know what the issue is?
- Sim. É configuração de CI/build: uso de `--config` duplicado no `electron-builder` causando perda da config base no publish.

Plano de correção (implementação):

1) Corrigir a composição de config do Electron Builder
- Arquivo: `electron-builder.release.yml`
  - Adicionar `extends: ./electron-builder.yml`
- Arquivo: `electron-builder.release.server.yml`
  - Adicionar `extends: ./electron-builder.server.yml`
- Motivo: manter arquivos de release separados, mas herdando 100% da config base (output dir, files, nsis, etc.).

2) Ajustar scripts de publish para usar um único `--config`
- Arquivo: `package.json`
  - `build:electron:publish`:
    - de: `electron-builder --config electron-builder.yml --config electron-builder.release.yml --publish always`
    - para: `electron-builder --config electron-builder.release.yml --publish always`
  - `build:local-server:publish`:
    - de: `electron-builder --config electron-builder.server.yml --config electron-builder.release.server.yml --publish always`
    - para: `electron-builder --config electron-builder.release.server.yml --publish always`
- Motivo: evitar override inesperado; usar fluxo suportado e determinístico.

3) Endurecer validação do asar no workflow para não mascarar causa real
- Arquivo: `.github/workflows/desktop-release.yml`
- No passo `Validate Desktop asar contents`:
  - Remover hard fail imediato em “electron-dist não existe”.
  - Buscar `app.asar` em caminhos esperados e logar contexto claro:
    - primeiro `electron-dist/**/app.asar`
    - fallback `dist/**/app.asar`
  - Se achar em `dist` mas não em `electron-dist`, emitir warning explicando mismatch de output.
  - Só falhar de fato se nenhum `app.asar` for encontrado.
- Motivo: evitar “falso negativo” e melhorar diagnóstico em qualquer regressão futura.

4) Preservar gate de integridade (não relaxar qualidade)
- Manter check obrigatório: `app.asar` deve conter `dist/index.html`.
- Manter checks do Local Server (existência, tamanho mínimo, SHA512) como estão.

5) Validação final esperada
- Rodar tag nova (`v1.3.15` ou próxima):
  - `Build and publish Desktop release` gera artefato no diretório correto.
  - `Validate Desktop asar contents` encontra `app.asar` e valida `dist/index.html`.
  - Pipeline segue para Local Server sem bloqueio artificial.

Detalhes técnicos (resumo):
- Causa raiz: estratégia de CLI/config do electron-builder no publish.
- Arquivos-alvo da correção:
  - `electron-builder.release.yml`
  - `electron-builder.release.server.yml`
  - `package.json`
  - `.github/workflows/desktop-release.yml`
