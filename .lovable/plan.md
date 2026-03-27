
Problema real (reformulado):
- O `app.asar` já está sendo encontrado corretamente.
- A falha atual (`exit code 141`) é **SIGPIPE** no shell do GitHub Actions (`bash -eo pipefail`), causada por pipelines que cortam saída com `head`/`grep -q`.
- Ou seja: o pipeline está quebrando no **comando de diagnóstico/validação**, não no empacotamento.

Do I know what the issue is?
- Sim. É um falso fail de shell por `pipefail` + comandos que encerram leitura antes do produtor terminar.

Arquivos a corrigir:
- `.github/workflows/desktop-release.yml` (principal e suficiente para destravar).

Plano objetivo de correção:
1) Remover comandos propensos a SIGPIPE no step `Validate Desktop asar contents`
- Trocar padrões como:
  - `echo "$ASAR_LIST" | head -50`
  - `echo "$ASAR_LIST" | grep -qE ...`
  - `... | grep ... | head -20`
- Por versões sem pipe frágil, usando here-string/awk/grep direto:
  - `awk 'NR<=50{print}' <<< "$ASAR_LIST"`
  - `grep -qE '(^|/)dist/index\.html$' <<< "$ASAR_LIST"`
  - `awk 'BEGIN{IGNORECASE=1}/dist\//{print; if(++n==20) exit}' <<< "$ASAR_LIST"`

2) Aplicar o mesmo hardening nos outros pontos de preview de saída do workflow
- Substituir usos de `| head` em logs diagnósticos por alternativas sem SIGPIPE.
- Manter comportamento idêntico (somente robustez).

3) Preservar gate de integridade (sem afrouxar qualidade)
- Continuar exigindo:
  - `app.asar` encontrado.
  - `dist/index.html` presente dentro do asar.
- Falhar apenas quando o artefato realmente estiver inválido.

4) Validação final esperada
- Nova tag (`v1.3.17` ou próxima):
  - build desktop conclui;
  - validação do asar passa sem `141`;
  - pipeline segue para Local Server e upload normal.

Detalhe técnico curto:
- `141 = 128 + 13 (SIGPIPE)`.
- Em Actions com `pipefail`, isso vira falha do step mesmo com artefato correto.
