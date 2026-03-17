
Objetivo: corrigir a tela branca no app Desktop empacotado.

Diagnóstico mais provável
- O build web está sendo carregado no Electron via `loadFile(...)`.
- O `vite.config.ts` não define `base`, então o build padrão usa caminhos absolutos (`/assets/...`).
- Em app empacotado com `file://`, esses caminhos absolutos quebram e o React não carrega, resultando em tela branca.
- Há um segundo risco no Desktop: o app usa `BrowserRouter`. Em ambiente `file://`, o pathname vira algo como o caminho físico do arquivo, o que pode quebrar o roteamento mesmo depois que os assets passarem a carregar.

Sinais no código que apontam isso
- `electron/main.js` carrega `../dist/index.html` quando empacotado.
- `vite.config.ts` não tem `base: "./"` para build local em arquivo.
- `src/App.tsx` usa `BrowserRouter`, não um roteador compatível com `file://`.
- A captura mostra janela branca total, o que é compatível com falha de carregamento do bundle principal.

Plano de correção
1. Ajustar o build do Vite para Electron empacotado
- Configurar `vite.config.ts` para gerar assets relativos no build do Desktop.
- Caminho recomendado:
  - usar `base: "./"` no build voltado ao Electron; ou
  - usar uma flag/modo de build específico para desktop.
- Objetivo: garantir que `index.html` referencie `./assets/...` em vez de `/assets/...`.

2. Tornar o roteamento compatível com Desktop
- Substituir o roteador por um wrapper condicional:
  - Web: `BrowserRouter`
  - Desktop: `HashRouter`
- Isso evita que o caminho físico do arquivo interfira nas rotas da aplicação.
- Também revisarei links/redirects para manter compatibilidade com hash routing no Desktop.

3. Remover dependência desnecessária no HTML base
- Revisar `index.html` para evitar qualquer script externo não essencial no app Desktop.
- Em especial, validar o impacto do script externo atual e manter o HTML do build o mais previsível possível para uso offline/local.

4. Melhorar diagnóstico do Desktop
- Adicionar logging mínimo no processo principal e no renderer para capturar:
  - falha de carregamento de página
  - erro de bundle
  - navegação inválida
- Assim, se ainda houver tela branca, o próximo erro ficará explícito.

5. Validar o fluxo empacotado
- Confirmar que o app:
  - abre fora do modo dev
  - renderiza a tela de login/dashboard
  - navega entre rotas sem recarregar em branco
- O teste principal deve ser feito no instalador gerado, não só em `desktop:dev`.

Arquivos que eu revisaria na implementação
- `vite.config.ts`
- `src/App.tsx`
- possivelmente um novo util de roteamento/runtime
- `index.html`
- `electron/main.js` para logs de carregamento

Resultado esperado
- O executável instalado deixa de abrir em branco.
- O React renderiza normalmente no Desktop.
- As rotas passam a funcionar corretamente no ambiente empacotado.
- O app continua funcionando na web sem regressão.
