
Objetivo: corrigir os 3 erros com base numa investigação mais profunda do fluxo real, porque o problema não está só na extração — ele está principalmente na forma como o frontend interpreta e aplica os dados.

### O que a investigação confirmou

1. **A extração do backend está funcionando melhor do que a UI mostra**
   - No tráfego real, a função retornou corretamente:
     - `ASO` para `teste1.pdf`
     - `NR10` para `teste2.pdf`
     - `NR34` para `teste3.pdf`
     - `NR35` para `teste4.pdf`
     - `Foto de rosto` para a imagem enviada
   - Ou seja: o backend já está encontrando o tipo real do documento.

2. **O tipo volta a virar “Outros” no frontend**
   - O problema está em `src/hooks/useDocumentExtraction.ts` + `src/utils/documentParser.ts`.
   - O cliente ainda usa um tipo fechado:
     ```text
     'ASO' | 'NR10' | 'NR33' | 'NR35' | 'RG' | 'CPF' | 'CNH' | 'Outros'
     ```
   - Quando o backend devolve algo válido mas fora dessa lista, como `NR34` ou `Foto de rosto`, o cliente colapsa isso para `Outros`.
   - Isso explica o print mostrando “Outros” mesmo com a resposta correta da extração.

3. **O formulário não usa uma regra inteligente para escolher qual documento preenche cada campo**
   - Hoje o preenchimento é “primeiro que chegar/preencher vence”.
   - Exemplo real:
     - o ASO trouxe nome, CPF, sangue, gênero, função e empresa
     - outros certificados trouxeram função “Aluno” e outra empresa
   - Como o código usa vários `if (!watch('campo'))`, ele não trata o ASO como fonte principal.
   - Resultado: um documento mais fraco pode bloquear ou contaminar o preenchimento.

4. **Cargo/Função não está modelado corretamente para persistência**
   - Hoje o select guarda o **nome** da função em `role`.
   - O banco já tem `workers.job_function_id`, mas o modal não grava esse campo.
   - Mesmo quando cria uma função nova, o fluxo atual só seta texto no formulário; a relação real com `job_functions` não fica consistente.

5. **A foto do documento nunca é promovida para o campo de foto**
   - A imagem enviada já foi detectada como `Foto de rosto`.
   - Mas o modal só mostra foto quando o usuário usa o input manual de foto.
   - O fluxo de documentos **não liga** documentos do tipo foto ao estado `photoFile/photoPreview`.
   - Então a foto pode até ser extraída/classificada, mas nunca aparece no local destinado a ela.

6. **Há um ruído extra no modal**
   - O warning do console sobre `Badge` sem `forwardRef` vem de `DocumentsSection`.
   - Não parece ser a causa principal dos 3 bugs, mas vale limpar para não mascarar debugging futuro.

### Plano de correção

1. **Parar de reduzir tipos reais para “Outros”**
   - Arquivos:
     - `src/hooks/useDocumentExtraction.ts`
     - `src/utils/documentParser.ts`
     - `src/components/workers/NewWorkerDialog.tsx`
   - Ajustes:
     - trocar o `DocumentType` fechado por `string` ou por um modelo híbrido que preserve o tipo bruto retornado pela IA
     - preferir `detected_type`/`extracted_data.document_type` real em vez de normalizar tudo para a lista antiga
     - manter regras de cor/status para tipos conhecidos, mas sem destruir tipos novos como `NR34` ou `Foto de rosto`

2. **Centralizar o preenchimento automático com prioridade por tipo de documento**
   - Arquivo:
     - `src/components/workers/NewWorkerDialog.tsx`
   - Em vez de preencher campo por campo dentro de cada `processDocument`, criar uma etapa de consolidação:
     - ASO = fonte principal para nome, CPF, nascimento, gênero, sangue, empresa, cargo
     - RG/CPF/CNH = complemento para identidade/dados pessoais
     - NRs = complemento documental, não devem substituir cargo/empresa do ASO automaticamente
     - Foto de rosto = fonte para foto
   - Isso elimina o comportamento “primeiro documento vence” e faz o ASO prevalecer quando existir.

3. **Corrigir Cargo/Função de forma relacional**
   - Arquivos:
     - `src/components/workers/NewWorkerDialog.tsx`
     - possivelmente `src/hooks/useJobFunctions.ts`
   - Ajustes:
     - o formulário deve passar a trabalhar com `job_function_id`
     - o select deve usar `id` como valor e `name` como label
     - ao extrair uma função:
       - tentar match normalizado
       - se não existir, criar automaticamente
       - após criar, preencher `job_function_id` e também manter `role` textual coerente
     - no submit, gravar:
       - `job_function_id`
       - `role`
   - Observação importante:
     - hoje a criação de `job_functions` é restrita por permissão de admin
     - se este modal também for usado por usuários sem essa permissão, a criação precisará ir para um fluxo backend controlado ou para uma política adequada

4. **Ligar “Foto de rosto” ao campo de foto do trabalhador**
   - Arquivo:
     - `src/components/workers/NewWorkerDialog.tsx`
   - Ajustes:
     - quando um documento for identificado como foto de rosto/selfie/foto 3x4 etc., usar o próprio `doc.file` para preencher:
       - `photoFile`
       - `photoPreview`
     - mostrar imediatamente essa imagem na seção “Foto”
     - manter o upload manual como sobrescrita, caso o usuário queira trocar
   - Isso resolve o problema real: a foto extraída existe, mas hoje não entra no estado da foto do trabalhador.

5. **Melhorar matching de empresa**
   - Arquivo:
     - `src/components/workers/NewWorkerDialog.tsx`
   - Ajustes:
     - normalizar nomes antes de comparar:
       - caixa
       - acentos
       - pontuação
       - sufixos como LTDA / ME / EIRELI
     - isso aumenta muito a chance de mapear corretamente empresas extraídas do ASO

6. **Limpar warning do `Badge`**
   - Arquivo:
     - `src/components/ui/badge.tsx`
   - Ajuste:
     - converter `Badge` para `forwardRef`
   - Não é a causa principal, mas deixa o modal mais estável e reduz ruído de console.

### Resultado esperado após a correção

- `NR34`, `Foto de rosto` e qualquer outro tipo real deixam de aparecer como “Outros”.
- Os campos passam a ser preenchidos com prioridade correta, usando o ASO como fonte principal quando ele estiver presente.
- O cargo/função extraído deixa de ser apenas texto solto e passa a ficar vinculado ao cadastro real da função.
- Se a função não existir, ela pode ser criada e associada corretamente.
- A imagem enviada como foto de rosto passa a aparecer na área de foto do trabalhador automaticamente.
- O comportamento fica coerente com os prints e com o que já está vindo corretamente da extração.

### Arquivos principais envolvidos

- `src/components/workers/NewWorkerDialog.tsx`
- `src/hooks/useDocumentExtraction.ts`
- `src/utils/documentParser.ts`
- `src/hooks/useJobFunctions.ts`
- `src/components/ui/badge.tsx`

### Estratégia de implementação recomendada

```text
1. Preservar tipo bruto do documento
2. Consolidar dados extraídos por prioridade
3. Corrigir modelagem de job function (id + nome)
4. Promover “Foto de rosto” para a foto do trabalhador
5. Melhorar matching de empresa
6. Limpar warning do Badge
```
