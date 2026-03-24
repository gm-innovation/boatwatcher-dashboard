
Objetivo: corrigir o falso positivo de “STALE WORKFLOW” e destravar um ciclo limpo de release.

1) Diagnóstico confirmado
- O erro atual não é mais o `node-gyp`: o job está falhando no passo de diagnóstico.
- Causa raiz: o `grep "msvs_version"` está lendo o próprio arquivo do workflow e encontra a string dentro do próprio bloco de diagnóstico, gerando falha sempre.

2) Ajustes no CI (`.github/workflows/desktop-release.yml`)
- Reescrever o passo **Diagnostic - Verify workflow version** para validar o conteúdo do passo alvo (Setup native build tools), em vez de procurar string global no arquivo.
- Estratégia:
  - Extrair apenas o bloco do passo `Setup native build tools`.
  - Exibir esse bloco no log (fingerprint claro).
  - Falhar se o bloco **não** contiver exatamente `run: npx node-gyp install`.
- Manter os prints de `github.sha`, `github.ref`, `github.run_attempt` para rastreabilidade.
- Manter `npm ci --foreground-scripts --loglevel=verbose` como já está.

3) Novo ciclo de release limpo
- Atualizar `package.json` para `1.2.10`.
- Criar tag/release `v1.2.10` (não usar re-run do `v1.2.9`).

4) Validação final (o que precisa aparecer no run novo)
- Diagnóstico mostra o bloco real de `Setup native build tools`.
- Passo de diagnóstico passa sem falso positivo.
- Build Desktop conclui.
- Build/validação do Local Server conclui (existência `.exe`, tamanho, hash SHA512 com `server.yml`).
- Assets da release incluem Desktop (`.exe`, `.blockmap`, `latest.yml`) + Local Server (`.exe`, `server.yml`, e `.blockmap` se houver).

Detalhes técnicos
- A checagem atual é frágil por fazer busca textual global.
- A checagem por bloco do step é determinística e evita auto-match.
- O bump para `v1.2.10` garante execução em snapshot novo e elimina ambiguidade de runs antigos.
