
Objetivo

Corrigir de forma definitiva o build local do Desktop, porque o repositório ainda está com a configuração antiga e o erro continua sendo causado pelo bloco de publicação do GitHub.

Diagnóstico confirmado no código atual

O problema não é mais “teórico”: ele está visível nos arquivos atuais.

- `package.json` ainda está assim:
  - `build:electron = npm run build && electron-builder`
- `electron-builder.yml` ainda tem:
  - `owner: ${env.GH_OWNER}`
  - `repo: ${env.GH_REPO}`

Isso explica exatamente o erro:
```text
cannot expand pattern "${env.GH_OWNER}": env GH_OWNER is not defined
```

Ou seja:
- a correção anterior não entrou de fato no `package.json`;
- além disso, o YAML principal continua acoplado ao GitHub;
- por isso o build local segue quebrando.

Plano de correção

1. Separar configuração local da configuração de release
Vou deixar o arquivo principal de build compatível com uso local:
- `electron-builder.yml` fica sem placeholders obrigatórios de GitHub
- a configuração de publicação vai para um arquivo específico de release, por exemplo:
  - `electron-builder.release.yml`

Com isso:
- build local não depende de `GH_OWNER` / `GH_REPO`
- release automática continua podendo usar GitHub normalmente

2. Corrigir os scripts do `package.json`
Vou ajustar para dois fluxos explícitos:

- Local:
```text
npm run build:electron
```
usa:
```text
electron-builder --publish never
```

- Release:
```text
npm run build:electron:publish
```
usa o config de release + publish:
```text
electron-builder --config electron-builder.yml --config electron-builder.release.yml --publish always
```

3. Preservar o workflow do GitHub
O workflow `.github/workflows/desktop-release.yml` continuará:
- rodando no Windows
- recebendo `GH_TOKEN`, `GH_OWNER`, `GH_REPO`
- usando apenas o script de publish

Assim o CI continua publicando no GitHub Releases, mas o computador local não precisa dessas variáveis.

4. Atualizar a documentação para evitar repetição do problema
Vou alinhar `README.md` e `electron/README.md` para deixar claro:

```text
Build local:
npm run build:electron

Publicação:
npm run build:electron:publish
```

E também registrar que:
- local não precisa de variáveis do GitHub
- release automática depende do workflow por tag `v*`

Resultado esperado

Depois dessa implementação:

```text
Local:
npm install
npm run build:electron
-> gera o .exe sem GH_OWNER / GH_REPO

GitHub Actions:
git tag v1.0.1
git push origin v1.0.1
-> publica release com latest.yml + .exe + blockmap
```

Arquivos que pretendo ajustar

- `package.json`
- `electron-builder.yml`
- novo `electron-builder.release.yml`
- `.github/workflows/desktop-release.yml` (só se precisar alinhar o comando final)
- `README.md`
- `electron/README.md`

Observação importante

Mesmo que eu aplique só `--publish never`, o caminho mais robusto aqui é também remover os placeholders do config principal. Assim o projeto fica estável para qualquer pessoa da equipe rodar localmente, sem depender de variáveis de CI.
