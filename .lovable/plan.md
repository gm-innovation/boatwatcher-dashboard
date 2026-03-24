
Objetivo: eliminar o “loop de re-run” e garantir que o próximo release rode com o workflow corrigido, com diagnóstico explícito caso ainda falhe.

1) Diagnóstico consolidado (com base no que revisei)
- O re-run que você fez é do mesmo job antigo (`Refactor release workflow #14`, commit `19906f0`), então ele repete exatamente o mesmo contexto de execução.
- No código atual, o step inválido com `msvs_version` já não existe mais (`Setup native build tools` está com `npx node-gyp install`), então a falha recorrente indica execução em snapshot antigo e/ou falta de rastreabilidade do step real que quebra.

2) Ajustes de implementação no CI (para tirar ambiguidade)
- Arquivo: `.github/workflows/desktop-release.yml`
- Adicionar um bloco de diagnóstico logo após checkout:
  - imprimir `github.sha`, `github.ref`, `github.run_attempt`;
  - imprimir o trecho carregado do próprio workflow (linhas do step de build tools);
  - falhar cedo se aparecer `msvs_version` em qualquer arquivo de workflow.
- Tornar erro mais rastreável:
  - `npm ci --foreground-scripts --loglevel=verbose`;
  - em `if: failure()`, salvar logs-chave como artifact (npm/electron-builder).
- Manter o step de build tools apenas com:
  - `shell: bash`
  - `run: npx node-gyp install`

3) Estratégia operacional para sair do run antigo
- Não usar mais re-run do `#14`.
- Gerar um ciclo limpo com nova versão/tag (ex.: `v1.2.9`) para forçar execução do workflow novo.
- Resultado esperado: novo run com SHA diferente e logs de diagnóstico mostrando claramente qual step executou.

4) Validação final (fim a fim)
- Confirmar no run novo:
  - step de diagnóstico mostrando que não há `msvs_version`;
  - `Setup native build tools` passando;
  - build desktop concluído;
  - build local server + validação de tamanho/hash;
  - upload de artefatos na release.
- Conferir assets finais da tag nova:
  - Desktop: `.exe`, `.blockmap`, `latest.yml`
  - Local Server: `.exe`, `server.yml` (e `.blockmap` se gerado)

Detalhes técnicos
- Raiz do problema prático: re-run reaproveita o mesmo contexto do run original, então não garante que você está testando a versão mais nova do workflow.
- Correção estrutural: adicionar “fingerprint” do workflow carregado + logs detalhados + usar nova tag para run limpo.
- Benefício: para de “adivinhar” onde quebrou e evita falso positivo de que a correção não foi aplicada.

Arquivos a ajustar
- `.github/workflows/desktop-release.yml`
- `package.json` (somente bump de versão para nova tag limpa)
