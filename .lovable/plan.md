
Objetivo: destravar o pipeline de release (atualmente falhando no passo **Validate Desktop asar contents**) e voltar a permitir atualização de versão/tag sem quebrar as validações de integridade.

Diagnóstico confirmado (pelos logs e YAML atual):
1) O erro ocorre logo na primeira linha do passo de validação do asar (`ASAR=$(find electron-dist ...)`) com exit code 1.
2) Isso indica falha de comando/ambiente antes mesmo da checagem `if [ -z "$ASAR" ]`.
3) O warning de Node 20 é apenas aviso, não é a causa do fail.
4) O bloqueio atual é de script de CI (robustez no runner Windows), não de bump de versão em si.

Plano de correção (implementação):
1) Tornar o passo “Validate Desktop asar contents” robusto no Windows runner  
   - Trocar busca do `app.asar` para abordagem tolerante a erro (sem abortar na atribuição de variável).
   - Garantir que “não encontrado” seja tratado por lógica explícita (mensagem clara) e não por crash da shell.

2) Adicionar diagnóstico objetivo antes da validação  
   - Logar conteúdo de `electron-dist` (quando existir) para mostrar onde os artefatos estão sendo gerados.
   - Logar caminho final do asar encontrado.

3) Manter a validação de integridade, mas com falha “inteligente”  
   - Se `app.asar` existir: validar presença de `dist/index.html` dentro do asar (continua bloqueando release quebrada).
   - Se não existir: retornar erro com contexto (estrutura de pastas), evitando erro genérico de shell.

4) Aplicar o mesmo hardening para descobertas de arquivo no restante do workflow  
   - Padronizar os outros pontos que usam `find`/detecção de artefato (principalmente Local Server), para evitar próximo bloqueio em cascata depois que esse passo passar.

5) Validação final do fluxo  
   - Rodar em tag (`v1.3.x`) e confirmar sequência completa:
     build desktop → validação asar → build local server → checks de tamanho/hash → upload.
   - Resultado esperado: pipeline volta a publicar normalmente e qualquer falha futura vem com diagnóstico claro (não mais “exit code 1” opaco).

Detalhes técnicos (resumo):
- Causa raiz prática: script de validação do asar frágil no ambiente Windows + bash com `-e/-o pipefail`, abortando na linha de busca.
- Não é problema de `package.json` version bump.
- Não é problema principal de “horário” nem do warning de depreciação do Node 20.
