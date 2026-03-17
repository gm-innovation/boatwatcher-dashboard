
Objetivo: configurar o update semi automático usando GitHub Releases como origem das versões, sem instalar nada sem autorização do operador.

Como está hoje no projeto
- O app já tem a lógica de aviso/autorização no `electron/main.js`.
- Hoje ele usa provedor `generic`, não `github`.
- A URL de update vem de:
  - variável `DOCKCHECK_DESKTOP_UPDATE_URL`, ou
  - configuração salva no app (`updateUrl`).
- O app só verifica atualização se estiver empacotado e se essa URL estiver preenchida.

Melhor caminho com o código atual
- Usar o GitHub apenas como “servidor de arquivos” das releases.
- Não precisa mudar a lógica de autorização do operador.
- Basta publicar os artefatos corretos no GitHub Releases e apontar a URL de update para o caminho de download da última release.

Configuração recomendada no GitHub
1. Criar/conectar o repositório no GitHub.
2. A cada nova versão:
   - aumentar o `version` no `package.json`
   - gerar o build com `npm run build:electron`
   - publicar no GitHub Release os arquivos gerados em `electron-dist/`, principalmente:
     - instalador `.exe`
     - `latest.yml`
     - quaisquer arquivos `.blockmap` gerados
3. Criar a release com tag igual à versão, por exemplo:
   - `v1.0.0`
   - `v1.0.1`

URL que deve ser usada no app
Use esta base:
```text
https://github.com/SEU_USUARIO/SEU_REPOSITORIO/releases/latest/download
```

Exemplo:
```text
https://github.com/dockcheck/desktop/releases/latest/download
```

Por que isso funciona
- O updater atual procura `latest.yml` nessa URL base.
- Então ele vai tentar ler:
```text
https://github.com/SEU_USUARIO/SEU_REPOSITORIO/releases/latest/download/latest.yml
```
- Se o `latest.yml` estiver anexado na release mais recente, o app consegue descobrir a nova versão.
- Depois disso, ele mostra o aviso ao operador e só baixa se ele clicar em “Instalar agora”.

Passo a passo operacional
```text
1. alterar package.json -> version
2. npm run build:electron
3. abrir electron-dist/
4. subir latest.yml + .exe + blockmap na GitHub Release
5. configurar no app a URL:
   /releases/latest/download
6. abrir o app empacotado
7. ele verifica update
8. operador autoriza a instalação
```

O que é obrigatório para funcionar
- `package.json` precisa ter versão real e crescente.
- Cada release precisa ter `latest.yml` anexado.
- O nome do `.exe` publicado deve bater com o que o `latest.yml` referencia.
- O teste deve ser feito no app instalado/empacotado, não no modo dev.

Limitações importantes
- Se você só enviar o `.exe` e não enviar `latest.yml`, o update não funciona.
- Se a versão não mudar, o app não detecta novidade.
- Se a release ficar como draft ou privada sem acesso adequado, o updater pode falhar.
- No estado atual, isso é “semi automático”: detectar, avisar, pedir autorização, baixar e instalar.

Opção futura mais robusta
Se quiserem depois, dá para evoluir para publicação automática no GitHub Releases:
- adicionar `publish` no `electron-builder.yml`
- usar provider `github`
- automatizar upload via token/GitHub Actions

Mas para agora, o caminho mais rápido e compatível com o código atual é:
- manter provider `generic`
- usar GitHub Releases como host
- configurar a URL `releases/latest/download`

Validação que eu recomendo fazer
1. publicar uma versão `v1.0.0`
2. instalar essa versão
3. publicar `v1.0.1` com `latest.yml`
4. abrir o app antigo
5. confirmar que aparece o aviso para o operador
6. clicar em “Instalar agora” e concluir o reinício

Se vocês quiserem, o próximo plano pode ser:
- preparar a configuração exata do `electron-builder.yml` para publicar direto no GitHub Releases; ou
- criar uma tela de “Configurações de atualização” no Desktop para o operador informar essa URL sem editar arquivos.
