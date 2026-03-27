

## Diagnóstico: causa raiz do -3h no Desktop

**O problema está na regex de detecção de timezone no `normalizeTimestamp` do `electron/agent.js` (linha 53).**

A regex `/[Zz+\-]\d{2}/` deveria detectar se o timestamp já contém informação de timezone (como `Z`, `+03:00`, `-03:00`). Porém, ela faz match com os **hifens da data** — por exemplo, em `"2025-03-27 16:31:00"`, ela encontra `-27` (o hífen antes do dia seguido de dois dígitos) e conclui incorretamente que o timestamp já tem timezone.

**Resultado**: a correção de +3h (BRT→UTC) é **pulada**, e o timestamp BRT é armazenado como se fosse UTC, causando o atraso de -3h no display.

Agravante: `Date.parse("2025-03-27 16:31:00")` com separador espaço é tratado como UTC por Node.js (não como horário local), reforçando o erro.

## Plano de correção

### 1. Corrigir `normalizeTimestamp` no agent (`electron/agent.js`)

Reescrever a função para parsing determinístico — sem depender de `Date.parse` para strings ambíguas:
- Extrair componentes da data via regex manual
- Tratar strings sem timezone como BRT (UTC-3) → somar 3h explicitamente via `Date.UTC`
- Manter lógica numérica existente
- Usar regex de timezone correta que busca apenas no FINAL da string: `/[Zz]$|[+-]\d{2}:?\d{2}$/`

### 2. Corrigir fallback de timezone no `getWorkersOnBoard` (`electron/database.js`)

Linhas 1149-1151: quando o timestamp não tem `Z` nem `+`, em vez de adicionar `Z` (tratar como UTC), adicionar `-03:00` (tratar como BRT). Isso protege dados antigos que já estão no SQLite com timestamp BRT sem marcador.

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `electron/agent.js` | Reescrever `normalizeTimestamp` com parsing determinístico |
| `electron/database.js` | `getWorkersOnBoard`: timestamps sem timezone → `-03:00` em vez de `Z` |

### Resultado esperado

- Novos eventos capturados pelo agent serão armazenados em UTC correto
- Dados antigos no SQLite sem timezone serão interpretados como BRT no display
- Desktop e Web mostrarão o mesmo horário

