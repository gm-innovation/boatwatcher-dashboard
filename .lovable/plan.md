
Objetivo: colocar o Dock Check Desktop para rodar no seu computador com a arquitetura correta: Servidor Local + aplicativo Desktop.

O que o projeto já mostra
- Existe um app Desktop baseado em Electron.
- Existe um Servidor Local dedicado em `server/`.
- O Desktop se conecta por padrão ao servidor em `http://localhost:3001`.
- Há instruções de build em `electron/README.md` e instaladores previstos em `electron-builder.yml`:
  - Windows: `DockCheck-Setup.exe`
  - Linux: `DockCheck.AppImage`

Como instalar hoje no seu computador

1. Instalar o Servidor Local
- Windows:
  - abrir a pasta `server`
  - executar `install.bat`
- Linux:
  - abrir a pasta `server`
  - rodar:
```bash
chmod +x install.sh
./install.sh
```
- Isso sobe a API local, o banco SQLite, backup automático, agente e sync.
- Porta padrão: `3001`

2. Preparar o projeto principal
- Na raiz do projeto:
```bash
npm install
```

3. Instalar dependências do Desktop
- Ainda na raiz:
```bash
npm install --save-dev electron electron-builder
npm install better-sqlite3 uuid
```

4. Configurar o endereço do servidor local
- O app Desktop usa `http://localhost:3001` por padrão.
- Se o servidor estiver em outra máquina da rede, configurar:
```text
http://IP-DO-SERVIDOR:3001
```
- Exemplo:
```text
http://192.168.1.100:3001
```

5. Rodar em modo desenvolvimento
- Terminal 1:
```bash
npm run dev
```
- Terminal 2:
```bash
npm run electron:dev
```

Bloqueio atual encontrado no código
- O arquivo `electron/README.md` cita:
  - `npm run electron:dev`
  - `npm run build:electron`
- Mas o `package.json` da raiz ainda não possui esses scripts.
- Então, hoje, a documentação de instalação do Desktop está à frente da configuração real do projeto.

Plano recomendado para fechar a instalação de verdade
1. Adicionar no `package.json` os scripts do Electron
- `electron:dev`
- `build:electron`
- possivelmente um script combinado para build do frontend + empacotamento

2. Validar o entrypoint do Electron
- confirmar `electron/main.js` como processo principal
- garantir que o build inclua `dist/` + `electron/`

3. Gerar o instalador
- Windows:
```bash
npm run build:electron
```
- Saída esperada:
```text
electron-dist/DockCheck-Setup.exe
```

4. Fluxo final de instalação no PC
```text
Servidor Local instalado e ativo
        +
Dock Check Desktop instalado via Setup.exe
        +
Desktop apontando para localhost:3001 ou IP do servidor local
```

Recomendação prática
- Se você quer usar agora para testes internos, o caminho mais rápido é:
  - instalar o Servidor Local
  - rodar o frontend com `npm run dev`
  - completar os scripts do Electron antes de tentar gerar o instalador
- Se você quer distribuição para operadores, o próximo passo ideal é eu fechar os scripts de empacotamento e validar o instalador ponta a ponta.

Detalhe técnico importante
- O Desktop é um thin client.
- Os dados não devem depender só do PC do operador; o componente central é o Servidor Local.
- Em rede local, vários terminais podem apontar para o mesmo servidor.

Plano de execução que eu seguiria
```text
Fase 1
  Validar scripts Electron no package.json
  Validar build local do app Desktop
  Gerar instalador Windows/Linux

Fase 2
  Testar instalação limpa em máquina nova
  Confirmar conexão com servidor local
  Confirmar sync, backup e agente

Fase 3
  Documentar passo a passo para operador final
  Incluir tela/configuração de endereço do servidor no primeiro uso
```

Resultado esperado
- Você instala o Servidor Local uma vez.
- Instala o Dock Check Desktop no computador do operador.
- O app abre já apontando para o servidor local e funciona com operação offline/local.
