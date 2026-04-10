
Objetivo desta etapa: corrigir o erro do executável instalado sem tocar em relatórios, sync, banco, dashboard nem fluxo de entrada/saída.

Do I know what the issue is? Sim.

O print novo confirma que agora não estamos mais no cenário de Windows Script Host. O caminho do erro é o do app instalado (`...Dock Check Local Server\resources\app.asar\electron\local-server-main.js:625`), então o executável abriu corretamente, mas falhou no primeiro carregamento de `require('../server/index')`. Isso aponta para um problema de boot/empacotamento do runtime local, não para a lógica de `access-logs.js`.

O problema exato desta fase é:
- o shell Electron sobe;
- o bootstrap entra em `local-server-main.js`;
- `server/index` não consegue ser carregado dentro do pacote instalado;
- o app mostra apenas a mensagem genérica, então em campo fica parecendo defeito do servidor inteiro, quando na prática o erro está na fronteira de empacotamento/runtime.

Plano cirúrgico:

1. Tornar o erro real visível no bootstrap
- Ajustar `electron/local-server-main.js` para guardar o erro original do `require('../server/index')` e exibi-lo no `dialog.showErrorBox`, não apenas no `error.log`.
- Mostrar também diagnóstico resumido por categoria:
  - dependência ausente;
  - falha de módulo nativo (`better-sqlite3`);
  - arquivo empacotado ausente;
  - incompatibilidade de build.
- Isso não muda nenhuma regra de negócio; só melhora a abertura do erro.

2. Blindar o empacotamento do Local Server
- Revisar `electron-builder.server.yml` para deixar explícito o empacotamento dos artefatos de runtime necessários ao servidor local, em vez de depender do comportamento implícito.
- Garantir especialmente:
  - inclusão dos arquivos do servidor;
  - presença dos metadados de runtime necessários;
  - unpack correto do `better-sqlite3` e do binário `.node`.
- A correção ficará restrita ao instalador do Local Server.

3. Eliminar risco de desalinhamento de dependências
- Alinhar a definição de dependências do servidor local com o runtime usado no build principal, principalmente `better-sqlite3`.
- O objetivo é evitar que o modo manual e o instalador apontem para expectativas diferentes de versão/binário.
- Isso impacta apenas a camada de inicialização/empacotamento.

4. Adicionar verificação pós-build específica do Local Server
- Reforçar o pipeline para validar o pacote do servidor local antes de publicar:
  - confirmar que `server/index.js` foi para o pacote;
  - confirmar que o pacote inclui as dependências esperadas;
  - confirmar que o binário nativo do SQLite ficou acessível no local correto.
- Assim evitamos publicar um instalador que abre a bandeja mas morre no `require`.

5. Preservar estritamente o que já funciona
- Não mexer em:
  - `server/routes/access-logs.js`
  - `server/index.js` na lógica de endpoints
  - `electron/sync.js`
  - `electron/agent.js`
  - relatórios já corrigidos
  - banco SQLite
  - fluxo manual/facial
  - sincronização e dashboards

Arquivos previstos para ajuste:
- `electron/local-server-main.js`
- `electron-builder.server.yml`
- `.github/workflows/desktop-release.yml`
- `scripts/verify-local-server-deps.cjs`
- `server/package.json` apenas se for necessário alinhar dependências de runtime

Arquivos que não serão mexidos:
- `server/routes/access-logs.js`
- `server/routes/*.js` de regra de negócio
- `electron/sync.js`
- `electron/database.js` salvo se houver necessidade mínima de diagnóstico, sem mudar comportamento funcional
- componentes React e relatórios

Resultado esperado:
- o executável instalado deixa de falhar silenciosamente no carregamento do servidor;
- se ainda houver falha, a própria janela passará a mostrar a causa real;
- o instalador publicado ficará coerente com o runtime esperado do SQLite;
- as correções ficam limitadas ao boot/packaging do Local Server, sem efeito colateral no restante do sistema.
