
Objetivo

Corrigir o erro do build local do Desktop sem quebrar a publicação automática no GitHub Releases.

Diagnóstico

O erro real é este:
```text
cannot expand pattern "${env.GH_OWNER}": env GH_OWNER is not defined
```

Pelo código atual:
- `electron-builder.yml` tem um bloco `publish` obrigatório com:
  - `${env.GH_OWNER}`
  - `${env.GH_REPO}`
- o script local `npm run build:electron` executa `electron-builder` normalmente
- no seu computador essas variáveis não existem
- então o empacotador falha antes de concluir o build local

Importante:
- os avisos `EBADENGINE`, `deprecated`, `Browserslist` e `duplicate dependency references` não são o motivo da falha atual
- o build só quebrou por causa da configuração de publicação do GitHub estar sendo exigida também no build local

Plano de correção

1. Separar build local de publicação
- Ajustar o script `build:electron` para gerar apenas o instalador local, sem tentar publicar.
- O caminho mais seguro é usar:
```text
electron-builder --publish never
```
- Assim, o `.exe` local funciona mesmo sem `GH_OWNER` e `GH_REPO`.

2. Preservar a publicação automática do GitHub
- Manter `build:electron:publish` para CI/release.
- Esse script continua sendo usado no workflow do GitHub Actions, onde:
  - `GH_OWNER`
  - `GH_REPO`
  - `GH_TOKEN`
  já existem.

3. Revisar a configuração do `electron-builder.yml`
Vou validar um destes dois formatos:
- opção A: manter o bloco `publish` no YAML e confiar no `--publish never` para build local;
- opção B: mover `publish` para uma configuração exclusiva de release, deixando o YAML principal compatível com build local.

Recomendação:
- usar a opção B se quisermos deixar o processo mais robusto e mais fácil para equipe local;
- usar a opção A se quisermos a correção mais rápida e mínima.

4. Validar o workflow de release
- Confirmar que `.github/workflows/desktop-release.yml` continua correto para publicar tags `v*`.
- Garantir que o workflow siga usando o script de publish, não o script local.

5. Tratar a experiência local
Depois da correção, o fluxo esperado fica assim:
```text
Local:
npm install
npm run build:electron
-> gera o .exe sem exigir variáveis do GitHub

Release:
git tag vX.Y.Z
git push --tags
-> GitHub Actions roda build:electron:publish
-> publica instalador + latest.yml + blockmap
```

Resultado esperado

Após a implementação:
- `npm run build:electron` vai funcionar localmente no Windows sem configurar `GH_OWNER`
- o `.exe` será gerado normalmente
- a publicação automática no GitHub continuará funcionando via workflow
- o sistema de atualização semi automática continuará compatível com GitHub Releases

Observações técnicas

- O `version` do `package.json` ainda está `0.0.0`; para updates reais, ele precisa ser incrementado a cada release.
- Os warnings de engine podem ser revisitados depois, mas não precisam ser atacados agora para destravar o `.exe`.
- Se quisermos, também posso planejar um pequeno ajuste na documentação para deixar claro:
  - qual comando é local
  - qual comando é só para release
  - quando usar tag no GitHub
