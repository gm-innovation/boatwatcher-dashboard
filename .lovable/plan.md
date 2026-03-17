
Objetivo

Implementar 2 frentes no Desktop:
1. trocar o favicon/ícone pelo arquivo `Favicon_512x512.png` enviado;
2. criar atualização semi automática, com aviso ao operador e instalação somente após autorização.

O que já identifiquei no projeto

- O web app ainda não referencia explicitamente um favicon em `index.html`.
- O build do Desktop usa `public/favicon.ico` em `electron-builder.yml` e também na janela do Electron em `electron/main.js`.
- O erro do `.exe` acontece porque o `.ico` atual é pequeno demais para o empacotamento.
- Ainda não existe nenhum fluxo de atualização no Desktop:
  - não há `electron-updater`
  - não há `autoUpdater`
  - não há eventos de “nova versão disponível”
  - não há UI para o operador autorizar update

Decisão já esclarecida

- Publicação das versões: ainda será decidida depois.
- Comportamento desejado: quando houver nova versão, o operador deve receber aviso e escolher “instalar agora”.

Plano de implementação

1. Troca do favicon e ícone do Desktop
- Copiar a imagem enviada para a pasta pública do projeto.
- Atualizar `index.html` para apontar explicitamente para o novo favicon PNG no navegador.
- Criar recursos de build próprios para Desktop a partir dessa imagem em alta resolução.
- Parar de depender do `public/favicon.ico` atual para o empacotamento.
- Atualizar `electron-builder.yml` para usar o novo ícone de build no Windows e instalador.
- Atualizar `electron/main.js` para abrir a janela com o novo ícone.

2. Ajustes de empacotamento
- Organizar uma pasta de recursos de build dedicada para Electron.
- Preencher metadados faltantes do app no `package.json` (`description` e `author`) para remover warnings do empacotamento.
- Manter o fluxo atual de `npm run build:electron`, mas agora com ícone compatível para gerar o `.exe` sem falha.

3. Atualização semi automática com autorização do operador
- Adicionar suporte de atualização no processo principal do Electron.
- O app passa a verificar se existe versão nova ao abrir e também poderá verificar manualmente por ação futura na interface.
- Se houver atualização:
  - o app avisa o operador;
  - não baixa nem instala automaticamente antes da autorização;
  - ao confirmar, inicia download e segue para instalação.
- Depois do download:
  - exibir confirmação final para reiniciar e concluir a instalação;
  - a instalação acontece apenas após aceite do operador.

4. Experiência do operador
- Como o app pode estar em qualquer tela (inclusive login), a base do fluxo deve ficar no Electron principal usando diálogo nativo.
- Opcionalmente, complementar com status visual na interface React:
  - “verificando atualização”
  - “nova versão disponível”
  - “baixando atualização”
  - “pronta para instalar”
- Isso evita depender de uma rota específica para o aviso aparecer.

5. Estrutura técnica prevista
Arquivos mais prováveis de mudança:
- `index.html`
- `package.json`
- `electron-builder.yml`
- `electron/main.js`
- `electron/preload.js`
- `src/lib/dataProvider.ts`
- possivelmente um novo hook/componente React para status de atualização
- novos arquivos de ícone em `public/` e/ou `build/`

6. Arquitetura do update
Fluxo planejado:
```text
app abre
-> verifica nova versão
-> encontrou update
-> mostra aviso ao operador
-> operador autoriza
-> baixa atualização
-> informa que está pronta
-> operador confirma reinício
-> instala a nova versão
```

7. Ponto em aberto que deixarei preparado
Como a origem das versões ainda não foi decidida, vou planejar a implementação de forma configurável:
- camada de atualização preparada para um provedor externo;
- depois vocês escolhem se a versão ficará em releases, servidor próprio ou outro canal;
- a lógica de autorização do operador já fica pronta independentemente da origem.

8. Resultado esperado
- o navegador usará o favicon novo;
- o `.exe` passará a ser gerado com o novo ícone corretamente;
- o Desktop poderá detectar nova versão e avisar o operador;
- nenhuma atualização será instalada sem consentimento;
- o processo ficará próximo do “semi automático”: detectar, avisar, pedir autorização e instalar.

Detalhes técnicos
- Hoje o bloqueio do build está no uso de `public/favicon.ico` em múltiplos pontos; a troca precisa separar ícone web de recurso de empacotamento.
- A atualização semi automática deve nascer no processo principal do Electron, não só no React, para funcionar mesmo antes do usuário navegar pelo sistema.
- A instalação autorizada pelo operador pede pelo menos um aceite antes do download/instalação; idealmente também um aceite final para reiniciar.
- Como a fonte das versões ainda não foi definida, a implementação deve evitar acoplamento rígido já na primeira entrega.
