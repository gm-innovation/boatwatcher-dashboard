

## Problema: As mudanças não chegaram ao app instalado

O aplicativo "Dock Check Local Server" instalado na sua máquina é a **v1.0.0** — uma versão compilada e instalada via setup. As mudanças que fizemos (botões "Reiniciar Serviço", "Sync Completo", lógica de download de devices no sync) existem no **código-fonte**, mas precisam de uma **nova build** para chegar ao app instalado.

Fechar e abrir a janela não reinicia o serviço — ele continua rodando na bandeja do sistema. E o "Verificar atualização" não encontrou nada porque **nenhuma nova versão foi publicada** no GitHub Releases.

### O que precisa ser feito

#### 1. Bumpar a versão para v1.1.0
**Arquivo:** `package.json`
- Alterar `"version": "0.0.0"` para `"version": "1.1.0"`
- Isso é necessário para que o electron-builder gere um instalador com versão superior à v1.0.0 atual

#### 2. Publicar nova release via GitHub Actions
- O workflow `.github/workflows/desktop-release.yml` é acionado por tags `v*` ou `workflow_dispatch`
- Ao criar uma tag `v1.1.0` no repositório, o CI automaticamente:
  - Compila o Local Server com as mudanças
  - Publica no GitHub Releases
  - O auto-updater no app v1.0.0 detecta e oferece a atualização

#### 3. Alternativa imediata (sem esperar build)
- Enquanto a nova build não é publicada, posso adicionar os **endpoints REST** no servidor local para que você consiga executar reinício e sync completo via linha de comando ou navegador:
  - `POST http://localhost:3001/sync/reset-and-full-sync` — limpa checkpoints e força download completo
  - `POST http://localhost:3001/sync/trigger` — força sincronização normal
  - Esses endpoints já existem no código do servidor (server/routes/sync.js)

### Plano de ação

| Passo | Ação |
|---|---|
| 1 | Bumpar versão para 1.1.0 no `package.json` |
| 2 | Você publica a tag `v1.1.0` no GitHub para acionar o workflow de release |
| 3 | O app instalado detecta a atualização automaticamente |
| 4 | Enquanto isso, testar via `curl -X POST http://localhost:3001/sync/reset-and-full-sync` no terminal para forçar sync completo |

### Sobre o lado web (nuvem)
As correções da Edge Function (`agent-sync`) e do `ProjectContext.tsx` **já estão ativas** na versão web. Se você acessar pelo navegador no endereço do preview, os projetos devem carregar corretamente. O problema de "0 projetos" no Desktop depende do sync local funcionar — que é exatamente o que o reset via curl ou a nova build resolve.

