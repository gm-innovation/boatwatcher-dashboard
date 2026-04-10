
Objetivo desta etapa: corrigir o problema de inicialização mostrado na imagem sem encostar na lógica de relatórios, sync, dashboard, banco ou fluxo de entrada/saída.

Diagnóstico confirmado após revisar o código e a imagem:
- Do I know what the issue is? Sim.
- O erro da imagem não aponta para um bug funcional em `server/routes/access-logs.js`.
- A janela é do **Windows Script Host**, ou seja: o Windows está tentando executar um arquivo `.js` diretamente, fora do runtime correto.
- A prova principal é o caminho da imagem: `...\boatwatcher-dashboard-main\server\routes\access-logs.js`. Isso é cara de **pasta de código-fonte extraída do GitHub/zip**, não do app instalado.
- `access-logs.js` é apenas uma rota Express. Ele foi feito para ser carregado por `server/index.js` dentro de Node/Electron, nunca para ser aberto diretamente pelo Windows.
- Portanto, reiniciar “o servidor” não resolve se a execução estiver partindo da pasta errada ou do arquivo errado.

Plano cirúrgico:
1. Blindar o fluxo de execução do Servidor Local
- Revisar o fluxo de inicialização para garantir que o operador tenha um ponto único e claro de execução.
- Manter como caminhos suportados apenas:
  - app instalado `Dock Check Local Server.exe`
  - fluxo manual explícito por script/batch
- Não tocar em `server/routes/access-logs.js` nem na lógica dos endpoints.

2. Adicionar um launcher manual seguro para Windows
- Criar um launcher `.bat/.cmd` simples e explícito para o modo “rodar a partir do código-fonte”, chamando o entrypoint correto com Node.
- Isso evita que alguém tente abrir `.js` internos da pasta `server/routes/`.

3. Melhorar a mensagem de erro/diagnóstico do bootstrap
- Ajustar `electron/local-server-main.js` para registrar e exibir um diagnóstico mais útil quando o servidor não sobe:
  - diferenciar falha real de módulo
  - indicar quando o problema aparenta ser “execução fora do app instalado”
- Assim o erro deixa de parecer um defeito em `access-logs.js`.

4. Deixar o caminho correto explícito na documentação
- Atualizar `server/README.md` e `electron/README.md` para deixar inequívoco:
  - não usar a pasta `boatwatcher-dashboard-main` como instalação
  - não abrir arquivos `.js` manualmente
  - usar o instalador `.exe` ou o launcher manual oficial

5. Preservar integralmente o que já está funcionando
- Nenhuma alteração em:
  - `electron/sync.js`
  - `electron/agent.js`
  - `server/routes/access-logs.js` (regra de negócio)
  - relatórios
  - dashboard
  - banco/local SQLite
  - sincronização com a nuvem

Arquivos previstos para ajuste:
- `electron/local-server-main.js`
- `server/README.md`
- `electron/README.md`
- `server/install.bat`
- novo launcher Windows seguro (ex.: `server/start-server.bat` ou equivalente)

Arquivos que não serão mexidos:
- `server/routes/access-logs.js`
- `server/index.js` (exceto se for estritamente necessário para mensagem de bootstrap)
- `electron/sync.js`
- `electron/database.js`
- componentes de relatórios já corrigidos

Resultado esperado:
- o servidor local deixa de depender de execução manual incorreta por `.js`;
- a pasta de código-fonte não vira mais um falso “instalador”;
- o erro deixa de aparecer como se `access-logs.js` estivesse quebrado;
- as correções anteriores de relatórios permanecem intactas.
