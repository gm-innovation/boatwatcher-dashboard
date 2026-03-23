Diagnóstico confirmado (com base no código atual e nos prints)
- O problema principal é real e está no repositório agora: `package.json` ainda está com `"version": "1.2.2"`.
- O pipeline publica com `electron-builder --publish always`, que usa **sempre** a versão do `package.json` como destino do release.
- Resultado: mesmo apagando o release/tag antigo, ao rodar novo build ele recria/publica em `v1.2.2`.
- O “erro” que aparece no Actions apesar de job “Success” é ruído do step de verificação (`continue-on-error: true`) que ainda gera annotation com `exit code 1`.

Plano de correção (definitivo)
1) Corrigir fonte da verdade de versão
- Arquivo: `package.json`
- Atualizar `version` de `1.2.2` para a próxima versão limpa (recomendado: `1.2.7`, já que `1.2.6` ficou inconsistente no release).

2) Bloquear mismatch tag x versão no CI (fail-fast)
- Arquivo: `.github/workflows/desktop-release.yml`
- Adicionar step antes do build para validar:
  - `github.ref_name` (ex.: `v1.2.7`)
  - `package.json version` (ex.: `1.2.7`)
- Se não bater, falhar imediatamente com mensagem clara (sem gerar release errado).

3) Evitar publicação acidental via `workflow_dispatch`
- Arquivo: `.github/workflows/desktop-release.yml`
- Restringir steps de publish para rodarem somente em tag (`refs/tags/v*`) ou transformar `workflow_dispatch` em modo sem publish.
- Isso impede recriação “do nada” de release antigo por execução manual.

4) Remover falso-positivo de erro nas annotations
- Arquivo: `.github/workflows/desktop-release.yml`
- Ajustar step “Verify Local Server update artifacts” para terminar explicitamente com sucesso (`exit /b 0`) quando ausência local de `.yml` for esperada.
- Mantém diagnóstico informativo sem “error badge” enganoso.

5) Higienização final de releases/tags quebradas
- Após merge das correções:
  - remover releases/tags inconsistentes (`v1.2.2` recriado indevidamente e `v1.2.6` incompleto, se necessário),
  - criar tag nova alinhada com `package.json` (`v1.2.7`),
  - publicar novamente.

Validação (fim a fim)
1. Workflow inicia por tag `v1.2.7`.
2. Step de validação confirma `tag == package.json version`.
3. Job conclui sem annotation de erro falso.
4. Release `v1.2.7` contém artefatos esperados (Desktop + Local Server + metadados).
5. `v1.2.2` não volta a aparecer após novas execuções.

Detalhes técnicos (arquivos impactados)
- `package.json` (bump de versão)
- `.github/workflows/desktop-release.yml` (guard de versão, proteção de publish manual e ajuste do step de verificação)
- Nenhuma mudança necessária na migration SQL mostrada no diff (ela é independente desse problema de versionamento).