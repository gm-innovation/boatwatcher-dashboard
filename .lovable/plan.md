
# Diagnóstico provável: não é conflito de horário do manual, é conflito de pipeline

Pelo código atual, o leitor manual e os leitores faciais **não usam o mesmo caminho**:

```text
Manual (tela /access-control)
→ grava direto na nuvem
→ dashboard lê da nuvem
→ aparece quase instantaneamente

Facial (ControlID local)
→ agente captura no servidor local
→ salva no SQLite local
→ sync.js faz upload assíncrono
→ dashboard desktop consulta a nuvem como fonte principal
→ só aparece quando o sync subir
```

## O que isso explica

Quando você testa o manual:
- o evento manual entra **direto** na nuvem
- o dashboard atualiza normalmente

Quando você testa o facial logo depois:
- ele depende do caminho local + sync
- se houver qualquer atraso/falha no upload, parece que “parou de funcionar”
- isso pode dar a impressão de que o manual “desligou” o facial, mas o mais provável é que só evidenciou a diferença entre os dois fluxos

## Evidências no código

1. `src/pages/AccessControl.tsx`
- o manual cria log com `timestamp: new Date().toISOString()`
- depois `saveAccessLog()` envia direto para `access_logs`

2. `src/hooks/useOfflineAccessControl.ts`
- online: `supabase.from('access_logs').insert(...)`
- ou seja, manual **não passa** pelo `electron/sync.js`

3. `electron/agent.js`
- facial salva primeiro no banco local via `insertAccessLog(...)`

4. `electron/sync.js`
- facial só vai para a nuvem quando `uploadLogs()` roda
- ainda existe fila local (`getUnsyncedLogs()`)

5. `src/hooks/useSupabase.ts`
- no desktop, “workers on board” usa **cloud-first**
- então, se o facial ficou preso localmente, o dashboard não reflete

## Outro sinal importante

O `download-access-logs` do backend mistura:
- logs de dispositivos do projeto
- logs manuais (`device_id is null` e `device_name = "Manual - ..."`)

Isso não bloqueia o facial por si só, mas reforça que os dois tipos de evento estão sendo tratados juntos no dashboard, apesar de chegarem por rotas diferentes.

## Plano de correção

### 1. Unificar a exibição no desktop para priorizar o servidor local quando ele estiver disponível
Ajustar o dashboard desktop para:
- usar nuvem como padrão
- mas, quando houver servidor local ativo, combinar ou priorizar os dados locais recentes para não depender exclusivamente do upload do facial

Arquivos afetados:
- `src/hooks/useSupabase.ts`
- `src/hooks/useDataProvider.ts`
- possivelmente `src/components/dashboard/RecentActivityFeed.tsx`

### 2. Fazer o manual também entrar no pipeline local no desktop
No runtime desktop com servidor local ativo:
- o evento manual deve ser gravado no servidor local primeiro
- depois o sync envia para a nuvem
- assim manual e facial passam a seguir a mesma lógica

Arquivos afetados:
- `src/pages/AccessControl.tsx`
- `src/hooks/useOfflineAccessControl.ts`
- `server/routes/access-logs.js`
- possivelmente `electron/database.js` para garantir consistência de metadados

### 3. Marcar claramente a origem e sincronização dos eventos
Adicionar metadados/telemetria para distinguir:
- manual local
- facial local
- já sincronizado
- pendente de upload

Isso ajuda a diagnosticar sem ambiguidade quando “o facial parou” versus “o facial capturou mas ainda não subiu”.

Arquivos afetados:
- `electron/database.js`
- `electron/sync.js`
- `server/routes/sync.js`
- painel/admin diagnostics se já existir campo compatível

### 4. Reforçar o fast-lane para o fluxo facial
Revisar o disparo de `triggerFastLaneSync()` e o tratamento de falhas para evitar que:
- um evento manual recém-chegado na nuvem dê aparência de sucesso
- enquanto o facial fica invisível por atraso de upload

Foco:
- garantir upload imediato após captura
- registrar erro quando a fila local não drena
- possivelmente preparar batching/retentativa se a fila estiver acumulando

Arquivos afetados:
- `electron/sync.js`
- `server/index.js`

### 5. Validar que a lógica de “workers on board” não alterna entre fontes incompatíveis
Hoje o sistema tem comportamento cloud-first no desktop.
Vou ajustar para evitar inconsistência entre:
- lista de bordo
- atividade recente
- logs locais ainda não sincronizados

Arquivos afetados:
- `src/hooks/useSupabase.ts`
- `src/components/dashboard/RecentActivityFeed.tsx`

## Resultado esperado

Depois da correção:
- testar o manual não “afeta” mais o facial
- manual e facial seguem fluxo coerente no desktop
- o dashboard não depende só do upload para refletir eventos recém-capturados
- desaparece a sensação de que um leitor funciona e o outro “para” após o teste

## Detalhes técnicos

```text
Problema central:
manual = cloud direto
facial = local -> sync -> cloud

dashboard desktop = cloud-first

Consequência:
manual aparece imediatamente
facial pode capturar localmente e ainda assim não aparecer
```

```text
Correção proposta:
desktop com servidor local ativo
→ manual e facial entram primeiro no local
→ dashboard considera local recente / fonte unificada
→ nuvem continua como persistência e sincronização
```

## Implementação sugerida na próxima etapa

1. Alterar o fluxo do manual no desktop para usar `localAccessLogs.insert`
2. Ajustar hooks do dashboard para considerar eventos locais recentes
3. Exibir estado “pendente de sincronização” quando aplicável
4. Revisar fast-lane e fila de upload para evitar falsa impressão de travamento
