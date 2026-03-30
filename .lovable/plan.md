

## Refatorar gestão de dispositivos: layout tabela + localização Embarcação/Dique + edição

Baseado nas screenshots do sistema em produção, o layout atual usa cards mas deveria ser uma tabela com colunas: Dispositivo, Projeto, Localização, Último Evento, Status, Ações.

A localização do dispositivo (Embarcação ou Dique) é um conceito-chave que define onde o acesso está sendo registrado e impacta diretamente o dashboard (contagem bordo vs dique) e relatórios.

### Alterações

**1. `src/components/devices/DeviceManagement.tsx`** — Refatoração principal

- Substituir layout de cards por tabela (`Table`, `TableHead`, `TableRow`, `TableCell`)
- Colunas: Dispositivo (nome), Projeto (nome do projeto vinculado), Localização (badge Embarcação/Dique), Último Evento (timestamp + direção), Status (badge Ativo/Offline), Ações
- **Localização (Embarcação/Dique)**:
  - Salvar em `configuration.access_location` com valores `'bordo'` ou `'dique'`
  - Badge colorido: verde "Embarcação" para `bordo`, laranja "Dique" para `dique`
  - Botão toggle nas Ações: "Mover p/ Dique" ↔ "Mover p/ Embarcação" (ícones Ship/Anchor)
  - Atualiza via supabase/localDevices conforme runtime
- **Botão editar** (ícone lápis): abre dialog com formulário pré-populado (mesmo schema `deviceSchema`) para editar nome, IP, serial, tipo, localização, projeto, agente, credenciais, direção de passagem
- **Toggle ativo/inativo**: switch inline na coluna Ações
- Manter botão deletar e demais ações existentes em dropdown ou inline

**2. `src/hooks/useProcessEvents.ts`** — Usar `access_location` do dispositivo

- Atualizar `DeviceLocationMap` para ler `configuration.access_location` dos dispositivos
- Onde hoje faz `deviceLocations[log.device_id] || 'bordo'`, usar o valor configurado no dispositivo

**3. Dashboard e relatórios** — Sem mudança de código

- Já consomem `location` do `ProcessedWorker`, que será alimentado corretamente pelo `access_location` do dispositivo

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `DeviceManagement.tsx` | Layout tabela, toggle Embarcação/Dique, dialog edição, botão editar |
| `useProcessEvents.ts` | Ler `configuration.access_location` para mapear localização |

