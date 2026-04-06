

## Por que os 2.531 trabalhadores não foram sincronizados nos dispositivos ControlID

### Diagnóstico — Dois problemas identificados

**Problema 1: Limite de 1.000 linhas do banco de dados**

A query `download-workers` na Edge Function não especifica `.range()`, então o banco retorna no máximo 1.000 registros por consulta (limite padrão). Com 2.531 trabalhadores ativos, **~1.500 nunca chegam ao servidor local**.

Arquivo: `supabase/functions/agent-sync/index.ts`, linha 716-721

**Problema 2: `devices_enrolled` está vazio `{}`**

O auto-enrollment (`autoEnrollWorkerPhoto`) só envia trabalhadores para o hardware se `devices_enrolled` contiver IDs de dispositivos. Todos os 2.531 registros têm `devices_enrolled = {}` (vazio). Ou seja, mesmo os 1.000 que chegam ao servidor local **não são enviados para o ControlID** porque o sistema não sabe em quais dispositivos cadastrá-los.

**Problema 3 (menor): Apenas 5 de 2.531 têm foto**

Sem `photo_url`, o enrollment cria o usuário no dispositivo mas sem biometria facial — o reconhecimento facial não funcionará.

### Plano de correção

#### 1. Paginação na Edge Function (resolve o limite de 1.000)

Na rota `download-workers` do `agent-sync`, implementar loop de paginação para buscar todos os registros:

```text
// Ao invés de uma query simples, fazer loop com .range(offset, offset+999)
// até retornar menos de 1000 resultados
let allWorkers = []
let offset = 0
while (true) {
  const { data } = await supabase.from('workers')...range(offset, offset + 999)
  allWorkers.push(...data)
  if (data.length < 1000) break
  offset += 1000
}
```

#### 2. Enrollment automático em TODOS os dispositivos do projeto

Criar uma lógica que, quando `devices_enrolled` está vazio mas o trabalhador pertence ao projeto do agente, **automaticamente o cadastra em todos os dispositivos** do projeto. Isso é feito no `electron/sync.js`:

```text
// Se devices_enrolled está vazio, considerar todos os devices do projeto
const targetDevices = devicesEnrolled.length > 0
  ? devicesEnrolled
  : allProjectDeviceIds;  // fallback: todos os dispositivos
```

#### 3. Enrollment em lote (batch) para 2.500+ trabalhadores

O enrollment individual (1 por vez com download de foto) seria muito lento para 2.500 registros. Adicionar:
- Controle de progresso (`enrollmentProgress` no status de sync)
- Processamento em lote com limite de concorrência (5 dispositivos simultâneos)
- Checkpoint para retomar em caso de interrupção

### Arquivos a alterar

| Arquivo | Alteração |
|---|---|
| `supabase/functions/agent-sync/index.ts` | Paginação na rota `download-workers` |
| `electron/sync.js` | Fallback de `devices_enrolled` vazio → todos devices do projeto; batch enrollment com checkpoint |
| `electron/database.js` | Helper `getProjectDeviceIds()` para listar devices do projeto |

### O que NÃO muda
- Fluxo de enrollment via comando manual (web/desktop)
- Upload de logs de acesso
- Sincronização reversa recém-implementada
- RLS e autenticação

