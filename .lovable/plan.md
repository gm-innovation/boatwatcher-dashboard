

## Formatar códigos, normalizar textos e organizar colunas

### Contexto

Duas tabelas precisam de ajustes: a tabela principal de trabalhadores (`WorkerManagement.tsx`) e a tabela do relatório (`ReportsList.tsx`).

### Alterações

**1. Utilitário de formatação** (`src/lib/utils.ts`)

Adicionar 3 funções auxiliares:
- `formatWorkerCode(code)`: sem "#", com zero à esquerda até 9 (ex: "01", "02"... "09", "10", "11")
- `normalizeName(text)`: primeira letra maiúscula, restante minúsculas, por palavra
- `formatCpf(value)`: formata string numérica como `XXX.XXX.XXX-XX`

**2. `src/components/workers/WorkerManagement.tsx`**

- **Código (linha 1157-1161)**: Remover ícone `Hash`, usar `formatWorkerCode()` em vez de exibir `code` cru
- **Nome (linha 1171)**: Aplicar `normalizeName(worker.name)`
- **CPF (linha 1174)**: Aplicar `formatCpf(worker.document_number)`
- **Empresa (linha 1175)**: Aplicar `normalizeName()`
- **Função (linha 1183)**: Aplicar `normalizeName(worker.role)`
- **Colunas**: Adicionar `whitespace-nowrap` nas células para evitar quebra de linha; remover a coluna "Função" que já existe separada e reorganizar larguras para nada ser abreviado

**3. `src/components/reports/ReportsList.tsx`**

- **Código (linha 232)**: Usar `formatWorkerCode(worker.code)`
- **Nome (linha 233)**: Aplicar `normalizeName()`
- **CPF (linha 235)**: Aplicar `formatCpf()`
- **Empresa (linha 234)**: Aplicar `normalizeName()`
- **Função (linha 236)**: Aplicar `normalizeName()`
- **Colunas**: Adicionar `whitespace-nowrap` para evitar duas linhas

### Detalhes técnicos

Funções utilitárias:

```typescript
export function formatWorkerCode(code: number | string | null | undefined): string {
  if (code == null) return '-';
  const n = Number(code);
  return n < 10 ? `0${n}` : String(n);
}

export function normalizeName(text: string | null | undefined): string {
  if (!text) return '-';
  return text.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export function formatCpf(value: string | null | undefined): string {
  if (!value) return '-';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return value;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}
```

