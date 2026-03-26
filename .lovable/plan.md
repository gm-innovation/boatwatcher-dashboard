

# Adicionar Linha Expandível com Detalhes de Eventos por Trabalhador

## O que falta (conforme o print de produção)

1. **Linha expandível**: Clicar no chevron (▼) ao lado do nome expande uma seção de detalhes abaixo da linha do trabalhador
2. **Entrada/Saída com data completa**: A coluna Entrada mostra `dd/MM HH:mm` (não apenas `HH:mm`); Saída mostra badge "A bordo" quando aplicável
3. **Seção expandida dividida em dois períodos**:
   - **Período Diurno (05:00 - 18:59)**: lista todos os eventos individuais (ENTRADA verde / SAIDA laranja) com Dispositivo e Data/Horário, e contagem de registros
   - **Período Noturno (19:00 - 04:59)**: mesma estrutura, ou "Nenhum registro noturno." se vazio
4. **Header da seção expandida**: "Nome: X  Função: Y  Empresa: Z"
5. **Tempo total acumulado**: Exibido em formato `Xh Ym` (ex: `3602h 10m`) — calculado como soma de todo o período, não apenas um dia

## Mudanças

### `src/components/reports/WorkerTimeReport.tsx`

**Dados**:
- Incluir o array de logs brutos (`rawLogs`) em cada `WorkerTimeRow` para renderizar na expansão
- Incluir `device_name` de cada log
- Mudar `formatTime` para mostrar `dd/MM HH:mm` em vez de só `HH:mm`

**Interface da WorkerTimeRow**:
- Adicionar `rawLogs: Array<{ direction: string; device_name: string; timestamp: string }>` ao tipo

**CompanyGroup → WorkerRow**:
- Adicionar estado `expandedWorker` (set de IDs expandidos)
- Cada linha de trabalhador tem um chevron (▼/▲) clicável
- Ao expandir, renderizar abaixo uma `<tr>` com `<td colSpan={7}>` contendo:
  - Header: `Nome: X  Função: Y  Empresa: Z`
  - Grid 2 colunas:
    - Esquerda: "Período Diurno (05:00 - 18:59)" + contagem + tabela de eventos (Evento, Dispositivo, Data/Horário)
    - Direita: "Período Noturno (19:00 - 04:59)" + contagem + tabela ou mensagem vazia
  - Eventos coloridos: ENTRADA em verde, SAIDA em laranja/vermelho

**Classificação diurno/noturno**:
- Diurno: hora entre 05:00 e 18:59
- Noturno: hora entre 19:00 e 04:59

### Arquivo alterado
- `src/components/reports/WorkerTimeReport.tsx`

