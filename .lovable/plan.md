
Objetivo: eliminar a tela branca no Desktop pós-update com um hotfix que **nunca** deixa o app “mudo”, mesmo se houver erro no bootstrap do renderer.

1) Blindar o bootstrap do Desktop (anti-tela-branca)
- Arquivo: `electron/main.js`
- Implementar um “watchdog” de inicialização:
  - ao criar a janela, iniciar timeout (ex.: 10–15s);
  - esperar um evento explícito de “renderer pronto”;
  - se não chegar no prazo, renderizar uma tela de fallback HTML local com:
    - mensagem de falha de inicialização,
    - versão do app,
    - botão “Recarregar”,
    - botão “Abrir logs”.
- Manter logs detalhados de `did-fail-load`, `render-process-gone`, `unresponsive` e erros de console do renderer em arquivo local (`userData`).

2) Adicionar handshake de “renderer pronto”
- Arquivos: `electron/preload.js`, `src/main.tsx`
- Expor no preload um método seguro (`electronAPI.appReady()`).
- No `src/main.tsx`, disparar esse método logo após montar o React root.
- Isso permite distinguir “carregou de verdade” de “janela abriu mas app quebrou”.

3) Evitar crash silencioso do React
- Arquivos: `src/main.tsx` + novo componente de fallback (ex.: `src/components/desktop/DesktopFatalErrorBoundary.tsx`)
- Envolver `<App />` em Error Boundary global.
- Se houver erro fatal no render/hook:
  - mostrar fallback visual (não tela branca),
  - logar stack no console e no canal IPC de erro.

4) Tornar detecção Desktop mais resiliente
- Arquivos: `src/lib/runtimeProfile.ts`, `src/App.tsx`
- Hoje o roteador depende de `window.electronAPI`.
- Ajustar para considerar também protocolo `file:` como ambiente desktop (além de `electronAPI`), garantindo `HashRouter` mesmo se preload atrasar/falhar parcialmente.
- Isso reduz risco de quebra de navegação no build empacotado.

5) Trava de segurança no pipeline de release
- Arquivo: `.github/workflows/desktop-release.yml`
- Após `build:desktop`, validar `dist/index.html`:
  - assets com caminho relativo (não absoluto),
  - bundle principal presente.
- Se validação falhar, abortar release para não publicar versão com risco de tela branca.

6) Plano de rollout e recuperação
- Gerar hotfix de versão (ex.: `1.3.8`) com mudanças mínimas focadas no bootstrap.
- Publicar release via tag.
- Para quem já está na versão quebrada (tela branca sem UI), disponibilizar instalador manual dessa hotfix (update in-app pode ficar inacessível quando a UI não sobe).

Detalhes técnicos (resumo)
- Arquitetura alvo:
  - Main process com watchdog + fallback local + logging persistente.
  - Renderer com Error Boundary e sinal de “ready”.
  - Runtime profile robusto para escolher roteador corretamente no `file://`.
- Arquivos impactados:
  - `electron/main.js`
  - `electron/preload.js`
  - `src/main.tsx`
  - `src/lib/runtimeProfile.ts`
  - `src/App.tsx`
  - `.github/workflows/desktop-release.yml`
  - (novo) componente de fallback de erro fatal.

Validação (obrigatória, ponta a ponta)
- Teste E2E do Desktop empacotado:
  1) abrir app recém-instalado,
  2) login,
  3) navegar dashboard/admin/relatórios,
  4) confirmar ausência de tela branca.
- Teste de update:
  - atualizar da versão anterior funcional para hotfix,
  - abrir e repetir fluxo completo.
- Teste de falha forçada:
  - simular erro de renderer e confirmar que aparece fallback (não branco) + log acessível.
