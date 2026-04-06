
## Diagnóstico

O comportamento que você descreveu bate com um problema no **full-resync atual**:

- os dispositivos ficaram com **apenas 9 cadastros**
- esses 9 aparecem **duplicados**
- Alexandre continua sendo reconhecido como Gustavo

Pelo código atual, a re-sincronização total **não busca os 2.531 trabalhadores diretamente do backend**. Ela usa a base local do agente:

- `server/routes/devices.js` → `req.db.getWorkers()`
- `electron/sync.js` → `this.db.getWorkers()`

Ou seja: se o banco local do servidor tiver só 9 trabalhadores, o resync:
1. apaga o dispositivo
2. recadastra apenas esses 9
3. mantém o problema de mapeamento errado

## O que provavelmente aconteceu

Há dois efeitos combinados:

1. **Fonte errada no full-resync**  
   O resync está usando o cache local do agente, não a fonte completa e confiável.

2. **Reverse sync contaminando a base local/cloud**  
   Existe uma rotina de reverse sync em `electron/sync.js` que lê usuários do dispositivo e envia de volta para a nuvem os “desconhecidos”.  
   Como o dispositivo já estava com IDs errados/duplicados, isso pode ter reforçado registros inconsistentes em vez de corrigi-los.

## Evidências no código

### Full-resync atual
```text
server/routes/devices.js
const workers = req.db.getWorkers?.() || [];
const activeWorkers = workers.filter(...)
```

```text
electron/sync.js
const workers = this.db.getWorkers?.() || [];
const active = workers.filter(...)
```

### Download normal de trabalhadores
Já existe um fluxo correto para baixar trabalhadores da nuvem em massa:
```text
supabase/functions/agent-sync/index.ts
GET /download-workers
```

Esse endpoint foi feito justamente para baixar todos os trabalhadores ativos paginados.

### Reverse sync ativo
Também existe:
```text
electron/sync.js -> reverseSync()
supabase/functions/agent-sync/index.ts -> POST /reverse-sync-workers
```

Se o dispositivo está sujo, essa rotina pode reintroduzir inconsistências.

## Plano de correção

### 1. Corrigir a origem do full-resync
Alterar o full-resync para **não depender do `getWorkers()` local**.

Implementação:
- antes de recadastrar, forçar uma atualização completa de trabalhadores no agente
- ou buscar explicitamente os trabalhadores via endpoint já existente de download
- só depois executar o enrollment em massa

Abordagem recomendada:
- resetar `last_download_workers`
- chamar a rotina de download de trabalhadores
- validar quantos trabalhadores ativos vieram
- abortar se o total estiver anormalmente baixo
- só então limpar e reenrolar o dispositivo

### 2. Adicionar trava de segurança
Hoje o sistema aceita fazer full-resync mesmo com base local incompleta.

Vou adicionar proteção para:
- bloquear resync se vierem poucos trabalhadores (ex: menos de um mínimo esperado)
- retornar erro claro em vez de apagar o dispositivo e recadastrar dados incompletos
- registrar no log quantos trabalhadores serão enviados antes de começar

Exemplo da lógica:
```text
se totalWorkers < limite_minimo:
  aborta resync
  informa que a base local está incompleta
```

### 3. Desativar o reverse sync durante recuperação
Enquanto os dispositivos estiverem inconsistentes, o reverse sync não deve importar usuários “desconhecidos” do hardware de volta.

Vou ajustar para pelo menos uma destas estratégias:
- pausar o reverse sync por configuração
- ou ignorar reverse sync quando houver resync pendente/recentemente executado
- ou impedir importação de usuários vindos de dispositivos com base suspeita

A opção mais segura agora é **desabilitar temporariamente o reverse sync**.

### 4. Deduplicar por código no re-enrollment
Mesmo com a base correta, o full-resync deve impedir reenviar trabalhadores repetidos.

Vou incluir deduplicação antes do enrollment:
- chave principal: `code`
- se houver duplicidade de código, manter apenas um registro
- logar os conflitos encontrados

Isso evita casos como:
- Alexandre 2x
- Cristiano 2x
- Leonardo 3x
- Márcio 2x

### 5. Corrigir a UI/ação para disparar o resync correto
Hoje não vi evidência de botão na interface chamando esse endpoint diretamente, então o processo pode estar sendo feito via fluxo parcial/local.

Vou padronizar o disparo para usar **uma única implementação confiável** do full-resync, com retorno de:
- total baixado da nuvem
- total deduplicado
- total enviado ao dispositivo
- falhas por trabalhador

### 6. Revisar os registros incorretos de acesso
Depois de corrigir a sincronização dos dispositivos, ainda pode haver logs históricos atribuídos ao trabalhador errado.

Vou deixar o sistema preparado para:
- identificar acessos registrados com código antigo
- permitir correção dirigida dos eventos já afetados

## Arquivos que devem ser ajustados

- `server/routes/devices.js`
  - parar de usar apenas `req.db.getWorkers()` cru no full-resync
  - incluir validação de volume mínimo e deduplicação

- `electron/sync.js`
  - usar download completo antes do resync
  - bloquear reverse sync temporariamente
  - deduplicar trabalhadores por `code`

- `supabase/functions/agent-sync/index.ts`
  - opcionalmente expor suporte explícito para full-resync seguro
  - manter o download paginado como fonte principal

## Resultado esperado após a correção

Depois dessa correção, o fluxo certo será:

```text
1. agente baixa todos os trabalhadores ativos da nuvem
2. agente valida quantidade e remove duplicados por code
3. dispositivo é limpo
4. trabalhadores corretos são reenrolados com os códigos atuais
5. Alexandre volta a ser reconhecido pelo código dele
6. Gustavo deixa de receber saídas do Alexandre
```

## Detalhes técnicos

- O problema atual não parece ser o reconhecimento facial em si.
- O problema é o **cadastro enviado ao dispositivo**.
- O full-resync existente está confiando em uma base local aparentemente incompleta/suja.
- Como o dispositivo hoje mostra só 9 usuários duplicados, isso indica que o resync executado apagou a base anterior e regravou usando esse conjunto parcial.

## Validação depois da implementação

Vou considerar a correção pronta quando:
1. o resync listar quantidade coerente de trabalhadores antes de iniciar
2. o dispositivo deixar de exibir apenas 9 duplicados
3. Alexandre aparecer com o código correto no hardware
4. uma nova saída do Alexandre gerar log para Alexandre, não para Gustavo
