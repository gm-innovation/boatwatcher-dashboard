

## Editar Direção de Passagem pelo Front-End

### O que muda
Adicionar um seletor clicável de direção (Entrada / Saída) diretamente no card do dispositivo, permitindo alterar sem abrir formulário separado.

### Implementação

**Arquivo: `src/components/devices/DeviceManagement.tsx`**

1. No `DeviceCard`, tornar o badge de direção clicável (ou adicionar um `Select` inline ao lado dele) que alterna entre `entry`, `exit` e "Não definido".

2. Ao selecionar, fazer update no campo `configuration` do dispositivo:
   - Cloud: `supabase.from('devices').update({ configuration: { ...device.configuration, passage_direction: value } }).eq('id', device.id)`
   - Local: `localDevices.update(device.id, { configuration: { ...device.configuration, passage_direction: value } })`

3. Invalidar query `['devices']` e chamar `onRefresh()` após sucesso.

4. Exibir toast de confirmacao: "Direção atualizada para Entrada/Saída".

### UX
- O badge atual de direção vira um pequeno `Select` inline (compacto) no header do card, ao lado do badge de status.
- Opções: "↙ Entrada", "↗ Saída", "Sem direção".
- Feedback instantaneo via toast.

### Arquivos alterados
- `src/components/devices/DeviceManagement.tsx` (unico arquivo)

