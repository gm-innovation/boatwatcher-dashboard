
Objetivo: parar de reaproveitar um release “antigo” e tornar o pipeline à prova de artefato faltando para o Local Server.

1) Diagnóstico consolidado (o que está acontecendo)
- Você está certa: o que apareceu é o release antigo da `v1.2.7` (mesma tag), não um ciclo limpo com novo conteúdo.
- Recriar release com a mesma tag gera confusão de estado (tag/release/artefatos), e pode não refletir o commit esperado.
- Hoje o CI ainda empacota o Local Server duas vezes (uma para validar, outra para publicar), então ainda existe janela para publicar metadado sem `.exe`.
- O link de fallback de “Baixar manualmente” está hardcoded para repositório errado (`nickdfrancis/...`), o que piora a recuperação.

2) Implementação proposta (código)
- `.github/workflows/desktop-release.yml`
  - Trocar fluxo do Local Server para **build único + upload manual**:
    - Build local server com config de canal `server`, mas sem publish.
    - Verificar obrigatoriamente:
      - `.exe` existe
      - tamanho mínimo (>10MB)
      - `server.yml` existe
      - `sha512` do `server.yml` bate com o `.exe`
    - Upload explícito para a release da tag via `gh release upload --clobber`:
      - `DockCheck-Local-Server-Setup-*.exe`
      - `.exe.blockmap` (se existir)
      - `server.yml`
  - Manter falha bloqueante se qualquer validação falhar.

- `package.json`
  - Adicionar script de CI para build único do Local Server com channel config e sem publicar (ex.: `build:local-server:ci`).
  - Workflow passa a usar esse script, não `build:local-server:publish`.

- `electron/local-server-main.js` + `electron/server-ui.html`
  - Remover URL hardcoded de download manual.
  - Enviar/usar `manualDownloadUrl` dinâmico (derivado do repositório configurado), para abrir o release correto em erro 404/checksum.

3) Estratégia de release (operacional, para encerrar o loop)
- Não reaproveitar mais `v1.2.7`.
- Publicar **`v1.2.8`** (version bump + tag nova), para garantir trilha limpa e evitar colisão com artefatos antigos.
- Critério de pronto da release:
  - Desktop: `.exe`, `.blockmap`, `latest.yml`
  - Local Server: `.exe`, `server.yml` (e `.blockmap` se gerado)

4) Validação final (fim-a-fim)
- CI deve falhar se Local Server `.exe` não for publicado/consistente.
- No GitHub Release `v1.2.8`, confirmar presença dos artefatos.
- Em máquina com Local Server antigo, testar:
  - “Verificar atualização”
  - fallback “Baixar manualmente” abrindo o repo correto
  - instalação manual atualizando para a versão nova
  - dispositivos voltando após sync.

Detalhes técnicos (resumo)
- Raiz do problema: reutilização da mesma tag + fluxo de publish que recompila.
- Correção estrutural: “build once, verify once, upload those exact artifacts”.
- Benefício: elimina mismatch entre `server.yml` e binário, e evita release “verde” sem `.exe`.
