
Diagnóstico objetivo (com base no código atual):
- A tela vazia é reproduzível pelo estado de visibilidade em `electron/server-ui.html`.
- O dashboard começa com classe CSS `.dashboard { display: none; }`.
- Em `showDashboard()`, o código usa `dashboardScreen.style.display = ''` (vazio), então o `display:none` da classe continua ativo.
- Ao mesmo tempo, `setupScreen` é ocultado com `display: 'none'`.
- Resultado: setup escondido + dashboard ainda escondido = janela “vazia” (igual ao seu print).

Plano de correção (implementação):
1) Corrigir troca de telas (setup/dashboard) no `electron/server-ui.html`
- Substituir o controle atual por um único helper de estado (ex.: `setScreen('setup' | 'dashboard')`).
- Não depender de `style.display = ''` quando existe classe com `display:none`.
- Opção segura: usar `hidden`/`classList` para alternar visibilidade, ou forçar `dashboardScreen.style.display = 'block'`.

2) Tornar o boot da UI resiliente
- Na inicialização, exibir estado de carregamento curto.
- Se `window.serverAPI` não estiver disponível, mostrar erro visível na tela (em vez de silêncio).
- Garantir fallback para setup quando houver falha de IPC.

3) Ajustar fluxo pós-token para evitar “troca cega” de tela
- Após `setAgentToken`, só abrir dashboard depois de `refreshDashboard()` concluir sem erro.
- Se falhar, permanecer no setup e exibir mensagem de erro útil.

4) Melhorar observabilidade para evitar novo ciclo de erro silencioso
- Adicionar captura global de erro no renderer (`window.onerror` / `unhandledrejection`) e renderizar mensagem no painel.
- Logar erros críticos no `error.log` via IPC (opcional, mas recomendado).

5) Manter fluxo funcional já alinhado ao que você pediu
- Preservar formulário manual de dispositivo (IP, device_id, name, user, password).
- Preservar suporte a token de agente + sincronização.

Validação (aceite):
- Cenário A: sem token salvo → abrir Local Server mostra setup (campo token) visível.
- Cenário B: inserir token válido → dashboard aparece imediatamente (sem tela vazia).
- Cenário C: dashboard com 0 dispositivos → mostra estado vazio + botão de adicionar.
- Cenário D: adicionar dispositivo manual → aparece na tabela e pode testar conectividade.
- Cenário E: desconectar → volta ao setup sem travar.

Arquivos que serão ajustados:
- Principal: `electron/server-ui.html`
- Suporte (se necessário): `electron/local-server-main.js` (apenas para logging/erros IPC de UI)
