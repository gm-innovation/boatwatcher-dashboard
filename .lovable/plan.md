

## Alinhar modal de cadastro de trabalhador com os prints de referência

### Diferenças identificadas entre o código atual e os prints

1. **Tela de seleção de método**: Atualmente usa um Switch toggle no header. Os prints mostram dois cards grandes clicáveis ("Cadastro Manual" com ícone de edição e "Por Documentos" com ícone de documento) em uma tela intermediária com título "Como deseja cadastrar o trabalhador?"

2. **Headers das seções**: Os prints mostram "Informações Básicas" e "Dados Adicionais" com badge "Editável" ao lado do título. O código atual usa "Dados do Trabalhador" e "Dados Adicionais" sem badges.

3. **Campo Status**: Nos prints é um Select dropdown mostrando "Pendente de Análise". No código atual é apenas um Badge estático amarelo.

4. **Layout Empresa/Cargo**: Nos prints, Empresa tem placeholder "Selecione ou será preenchido" no modo documento. O Cargo/Função usa um Select com opções (não Input livre).

5. **Seção de Foto**: Nos prints mostra label "Foto", avatar quadrado com ícone de câmera, e botão "Adicionar Foto" / "Alterar Foto" abaixo. Tem botão X vermelho para remover foto quando presente. Layout diferente do atual.

6. **Gender/Blood type defaults**: Nos prints mostram "Não informado" como valor default nos selects.

7. **Projetos Autorizados**: Nos prints mostra "Nenhum projeto selecionado" como texto quando vazio, com botão "Gerenciar" com ícone de globo.

8. **Seção de Documentos**: Nos prints tem dois botões no header: "Manual" (toggle com ícone) e "Adicionar Documentos" (com ícone). Quando vazio mostra ícone de documento grande centralizado com "Nenhum documento cadastrado".

9. **Lista de documentos**: Nos prints cada documento tem borda colorida à esquerda por tipo (ASO=laranja, NR10=azul, NR34=verde, NR35=verde, Outros=cinza), mostra datas de emissão/validade, badge de status (Vencido em vermelho), e ícones de visualizar/download/deletar.

10. **Feedback de upload**: Banner verde "Sucesso - 5 arquivo(s) enviados e adicionados à fila de processamento", spinner "Extraindo dados dos documentos..." e botão "Cancelar Processamento".

11. **Botão "Criar Trabalhador"**: Verde com ícone de sparkle, ao lado de botão "Voltar" outline.

12. **Modo documento - header**: Mostra "Cadastro por Documentos" com seta "Voltar" que retorna à tela de seleção de método (não ao dialog anterior).

### Plano de implementação

**Arquivo: `src/components/workers/NewWorkerDialog.tsx`** (rewrite completo)

1. **Adicionar estado `step`** com 3 fases:
   - `'method-select'` — tela com os dois cards de seleção
   - `'manual'` — formulário de cadastro manual
   - `'document'` — formulário de cadastro por documentos

2. **Tela de seleção de método** (`step === 'method-select'`):
   - Título "Como deseja cadastrar o trabalhador?"
   - Subtítulo "Escolha o método de cadastro que preferir usar."
   - Dois cards lado a lado com ícone, título e descrição
   - Card "Cadastro Manual" → seta para `step = 'manual'`
   - Card "Por Documentos" → seta para `step = 'document'`

3. **Reformular seção "Informações Básicas"**:
   - CardTitle com badge "Editável"
   - Status como Select dropdown (Pendente de Análise, Ativo, Inativo, Bloqueado)
   - Empresa com placeholder contextual por modo
   - Cargo/Função como Select populado com job functions existentes (com fallback para input livre)

4. **Reformular seção "Dados Adicionais"**:
   - CardTitle com badge "Editável"
   - Foto: layout com label "Foto", avatar com botão X para remover, texto "Adicionar Foto"/"Alterar Foto"
   - Gender e Blood Type com opção "Não informado" como default

5. **Reformular seção "Documentos"**:
   - Header com botões "Manual" (toggle) e "Adicionar Documentos"
   - Estado vazio: ícone de documento centralizado + "Nenhum documento cadastrado"
   - Lista: cards com borda colorida por tipo, datas emissão/validade, badges de status (Vencido/Válido/Não informado), ícones de ação (olho, download, lixeira)

6. **Feedback de extração**:
   - Alert verde de sucesso com contagem de arquivos
   - Spinner com texto "Extraindo dados dos documentos..."
   - Botão "Cancelar Processamento"

7. **Botão "Voltar"** no modo manual/documento retorna para `step = 'method-select'`

8. **Footer**: Botão "Criar Trabalhador" verde com ícone Sparkles + "Voltar" outline

### Arquivo alterado
- `src/components/workers/NewWorkerDialog.tsx`

