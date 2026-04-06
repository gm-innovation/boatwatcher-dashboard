
Objetivo: corrigir a impressão das etiquetas sem depender de `window.open()` com `data:`/`blob:` URL.

Diagnóstico real:
- O diálogo de impressão está abrindo, mas o conteúdo impresso é um documento vazio `about:blank#blocked`.
- O problema não é mais “abrir a janela”; é que `src/components/workers/WorkerManagement.tsx` está enviando para impressão uma aba bloqueada/sem conteúdo:
  - `const dataUri = doc.output('dataurlstring')`
  - `const printWindow = window.open(dataUri)`
- No preview, isso vira uma página em branco bloqueada pelo Chromium/sandbox. Por isso a impressão aparece, mas a etiqueta não.

Plano de implementação:
1. Parar de imprimir a etiqueta via PDF em nova aba
- Remover a estratégia atual baseada em jsPDF + `window.open(dataUri)`.
- Não tentar mais `blob:` ou `data:` para impressão direta.

2. Usar a mesma estratégia confiável do relatório: imprimir o HTML atual com `window.print()`
- Criar um fluxo de impressão dentro da própria página.
- Montar uma versão “print-only” da etiqueta em HTML/CSS, com o mesmo layout da etiqueta atual:
  - tamanho 62mm x 100mm
  - borda
  - logo no topo direito
  - nome/cargo/empresa/projeto rotacionados
  - círculo com código
  - tipo sanguíneo quando existir

3. Renderizar uma área oculta de impressão para as etiquetas
- Em `WorkerManagement.tsx`, criar um estado temporário para a impressão, algo como:
  - workers selecionados
  - projeto selecionado
  - logo resolvida em data URL
  - nome customizado quando houver
- Renderizar essa área só quando houver uma impressão em andamento.
- Cada trabalhador vira uma “página” de etiqueta.

4. Aplicar CSS de impressão específico para etiquetas
- Em `src/index.css`, adicionar estilos de impressão específicos para o modo de etiqueta.
- Usar uma classe no `body` durante a impressão, por exemplo `printing-labels`, para:
  - esconder o restante da interface
  - mostrar apenas a área de etiquetas
- Como `@page` não pode ser escopado por seletor, injetar/remover um `<style>` temporário durante a impressão com:
  - `@page { size: 62mm 100mm; margin: 0; }`
- Isso evita quebrar a impressão dos relatórios já existentes.

5. Disparar a impressão só depois que o HTML estiver pronto
- Após preparar o estado de impressão, esperar o próximo paint da UI antes de chamar `window.print()`.
- Fazer limpeza com `afterprint`:
  - remover classe do `body`
  - remover estilo temporário
  - limpar estado da impressão

6. Reutilizar o mesmo fluxo nos dois pontos da tela
- Botão “Imprimir Etiquetas” da lista
- Botão “Imprimir Crachá” do detalhe do trabalhador
- Ambos devem usar a mesma lógica de impressão HTML.

Ajuste adicional importante:
- Corrigir o uso de nome customizado em `generateLabels`/novo fluxo:
  - hoje o código calcula `effectiveCustomName`, mas usa `customLabelName.trim()` em vez de `effectiveCustomName.trim()`
- Isso pode gerar inconsistência ao imprimir uma etiqueta individual.

Arquivos envolvidos:
- `src/components/workers/WorkerManagement.tsx`
- `src/index.css`
- Opcionalmente extrair a visualização para um componente dedicado, ex. `src/components/workers/WorkerLabelPrintSheet.tsx`, para manter o código limpo.

Resultado esperado:
- A impressão passa a usar o próprio documento da página, como no relatório.
- Não haverá nova aba `about:blank#blocked`.
- O preview de impressão mostrará a etiqueta real, não uma folha em branco.
