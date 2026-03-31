

## Reformular Configuração de Terminais — Baseado no Sistema de Referência

### Contexto
Os prints fornecidos mostram um sistema de referência com uma área administrativa de "Gerenciamento de Terminais" mais completa do que a implementação atual. O formulário de edição de terminal inclui campos adicionais (Localização textual, Cliente, Projeto/Obra, Método de Reconhecimento, toggles de Terminal Ativo / Captura de Foto / Sincronização Automática), além de uma área de sincronização de trabalhadores por cliente e sincronização de dados.

### O que mudar

#### 1. Expandir a tabela `manual_access_points` (migration)
Adicionar colunas para alinhar com o sistema de referência:
- `location_description` (text) — descrição livre do local (ex: "Convés")
- `client_id` (uuid, FK → clients) — cliente vinculado
- `recognition_method` (text, default 'code') — valores: `code`, `cpf`, `name`, `facial`
- `require_photo` (boolean, default false) — captura de foto obrigatória
- `auto_sync` (boolean, default true) — sincronização automática

#### 2. Reformular o formulário de terminal (`AccessPointConfig.tsx`)
Substituir o dialog compacto atual por um formulário fullscreen (como nos prints), com:
- Nome do Terminal (input)
- Localização (input livre)
- Cliente (select, carregado de `clients`)
- Projeto/Obra (select, filtrado pelo cliente selecionado)
- Método de Reconhecimento (select: Código, CPF, Nome, Reconhecimento Facial)
- Modo de Operação (select: Entrada e Saída / Apenas Entrada / Apenas Saída)
- Terminal Ativo (switch toggle)
- Captura de Foto Obrigatória (switch toggle)
- Sincronização Automática (switch toggle)
- Botão "Salvar Terminal" / "Atualizar Terminal" (azul, full-width)

#### 3. Reformular a página de configuração (`AccessControlConfig.tsx`)
Reorganizar em seções conforme os prints:
- **Lista de terminais** com opção de editar/criar (abre formulário inline ou tela dedicada)
- **Sincronização de Trabalhadores**: seletor de cliente + contagem de cache local + botão "Sincronizar Trabalhadores"
- **Sincronização de Dados**: botão para sincronizar clientes e projetos do sistema principal

#### 4. Arquivos afetados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar — adicionar colunas à `manual_access_points` |
| `src/components/access-control/AccessPointConfig.tsx` | Reescrever — formulário expandido com todos os campos |
| `src/pages/access-control/AccessControlConfig.tsx` | Reescrever — layout com seções de sync |
| `src/hooks/useOfflineAccessControl.ts` | Ajustar — sync de trabalhadores filtrado por cliente |

