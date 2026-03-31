

## Redesenhar Tela de Acesso conforme Sistema de Referência

### Problemas identificados
1. Logo do cliente não está sendo exibida centralizada no topo (está inline no header)
2. Badge "🚢 Bordo" / "🏗️ Dique" com emojis feios — remover
3. Layout não segue o padrão de referência (header centralizado com logo + nome do projeto + localização + terminal)
4. Tela de confirmação do trabalhador não mostra botões ENTRADA/SAÍDA lado a lado como no print — mostra um único botão "CONFIRMAR ENTRADA"
5. Falta banner "Acesso Liberado" verde e botão "Novo Acesso"

### Alterações

#### 1. `src/pages/AccessControl.tsx` — Redesenhar layout completo

**Header centralizado** (como no print):
- Logo do cliente centralizada no topo (imagem grande)
- Nome do projeto em negrito
- Nome do terminal + localização abaixo em texto menor
- Remover badge de localização com emoji
- Remover botão de settings do header (mover para shell ou remover)

**Tela de input** (sem trabalhador selecionado):
- Linha "Código do Trabalhador" + "Usar Câmera" alinhados
- Display numérico grande (texto ~5rem) dentro de um card
- Teclado numérico
- Botão "Verificar Acesso" azul full-width

**Tela de confirmação** (trabalhador selecionado):
- Banner verde "Acesso Liberado"
- Card "Informações do Trabalhador" com avatar, nome, badges (Ativo / Dentro/Fora), código, empresa, função
- Dois botões lado a lado: ENTRADA (verde) e SAÍDA (roxo/vermelho)
- Botão "Novo Acesso" no header para voltar

#### 2. `src/components/access-control/WorkerCard.tsx` — Expandir layout
- Avatar maior, labels "Código", "Empresa", "Função" como no print
- Badges de status (Ativo, Dentro/Fora)

#### 3. `src/components/access-control/AccessConfirmation.tsx` — Dois botões
- Substituir botão único por dois botões lado a lado: ENTRADA (verde) e SAÍDA (roxo)
- Callback recebe a direção escolhida

#### 4. `src/components/access-control/NumericKeypad.tsx` — Sem alteração funcional
- Já está correto conforme o print

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/pages/AccessControl.tsx` | Reescrever — layout centralizado com header de branding |
| `src/components/access-control/WorkerCard.tsx` | Reescrever — layout expandido com labels |
| `src/components/access-control/AccessConfirmation.tsx` | Reescrever — dois botões lado a lado |

