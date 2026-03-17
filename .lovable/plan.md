
Objetivo desta etapa: transformar o servidor local em um instalador separado do Desktop, com fluxo claro de instalação/execução e preparado para a arquitetura já existente.

O que o código atual mostra
- O Desktop já foi desenhado para apontar para um servidor local externo via `server-config.json`.
- O servidor local hoje existe como app Node/Express em `server/`, com scripts manuais (`install.bat` / `install.sh`).
- O fallback em nuvem já cobre operação quando o servidor local não está disponível.
- Portanto, o caminho mais consistente agora é: manter o Desktop como cliente e empacotar o servidor local como produto separado.

Fluxo proposto
```text
1. Instalar Dock Check Desktop (.exe do operador)
2. Instalar Dock Check Local Server (.exe separado, na máquina/servidor local)
3. Instalador do servidor:
   - instala arquivos
   - cria diretórios de dados/backups
   - registra serviço do Windows
   - inicia automaticamente
4. Desktop aponta para:
   - http://localhost:3001, ou
   - IP da máquina servidora na rede
5. Se o servidor cair:
   - Desktop entra em fallback em nuvem
6. Se o servidor voltar:
   - Desktop retorna ao modo local automaticamente
```

O que eu implementaria
1. Empacotamento próprio do servidor local
- Criar um build dedicado para `server/` no Windows.
- Gerar um `.exe`/instalador separado, em vez de depender de Node instalado manualmente.
- Incluir `index.js`, rotas, libs e dependências necessárias no pacote.

2. Serviço do Windows
- Adaptar o fluxo atual baseado em NSSM para algo distribuível no instalador.
- O ideal é o instalador já registrar/iniciar o serviço automaticamente.
- Manter nome do serviço alinhado com o projeto (`DockCheckServer` / `dockcheck-server`).

3. Estrutura de dados persistente
- Preservar `data/` e `backups/` fora da pasta temporária do instalador.
- Garantir caminho estável para:
  - banco SQLite
  - uploads locais
  - backups automáticos
  - configuração do servidor

4. Configuração de conexão
- Formalizar a configuração do endereço do servidor local no Desktop.
- Manter `localhost` como padrão para instalação na mesma máquina.
- Permitir IP fixo para cenário “servidor da obra + PCs operadores”.

5. Validação operacional
- Expor/checkar no Desktop:
  - URL configurada do servidor local
  - status do servidor
  - status da sync
  - modo atual: local ou fallback
- Isso evita suporte às cegas na instalação.

6. Documentação de implantação
- Escrever fluxo de instalação simples para operação real:
  - quando instalar só o Desktop
  - quando instalar Desktop + servidor local
  - quando usar servidor em outra máquina da rede

Arquivos/áreas que eu revisaria na próxima implementação
- `server/package.json`
- `server/index.js`
- `server/install.bat`
- `server/install.sh`
- `electron/main.js`
- `electron/preload.js`
- `src/lib/localServerProvider.ts`
- `src/components/admin/DiagnosticsPanel.tsx`
- documentação em `server/README.md` e `electron/README.md`

Decisão de produto recomendada
- Primeira entrega: servidor local como instalador separado no Windows.
- Desktop continua leve e independente.
- Isso combina melhor com a arquitetura já existente de “thin client + servidor local dedicado”.
- Embutir o servidor dentro do Desktop pode ficar como segunda etapa, se depois vocês quiserem cenário “tudo em uma máquina”.

Sobre a logo
- Concordo com o ajuste: a logo da área de trabalho e da barra de tarefas deve ser a mesma do favicon/identidade oficial.
- Mas eu deixaria isso para a etapa seguinte, depois de fechar o fluxo do servidor local, porque envolve empacotamento do ícone do Desktop e possivelmente dos recursos em `build/`.

Resultado esperado desta próxima etapa
- Vocês terão dois instaladores distintos:
  - Dock Check Desktop
  - Dock Check Local Server
- O servidor local poderá rodar como serviço do Windows.
- O Desktop poderá ser apontado para localhost ou para um IP da rede.
- O fallback em nuvem continuará como segurança quando o servidor local não estiver acessível.
