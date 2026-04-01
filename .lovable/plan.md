

## Ajustes na Tabela de Empresas — Conforme Print

### Diferenças identificadas no print vs código atual

| Elemento | Print | Atual |
|----------|-------|-------|
| Badge "X a bordo" (empresa) | Verde outline (borda verde, fundo claro) | Verde sólido (`bg-green-600 text-white`) |
| Funcionários | Texto simples bold, sem badge | `Badge variant="secondary"` |
| Badge "A bordo" (coluna Saída) | Verde outline | Azul sólido (`bg-blue-600`) |
| Permanência | Badge com borda roxa/verde | `Badge variant="outline"` cinza |
| TOTAL - "A bordo agora" | Verde outline | Verde sólido |
| TOTAL - Diurno/Noturno | "Diurno: 1" em vermelho, "Noturno: 0" em linha separada | Texto simples inline |

### Arquivo: `src/components/reports/CompanyReport.tsx`

1. **Badge "X a bordo"** (linha 313): trocar para `border border-green-500 text-green-600 bg-green-50 hover:bg-green-100`
2. **Funcionários** (linha 320): trocar `<Badge variant="secondary">` por `<span className="font-semibold">`
3. **Badge "A bordo" na Saída** (linha 331): trocar `bg-blue-600` para `border border-green-500 text-green-600 bg-transparent hover:bg-green-50`
4. **Permanência** (linha 337): adicionar cor condicional — se `onBoardNow > 0` usar borda verde, senão manter outline cinza
5. **TOTAL "A bordo agora"** (linha 352): trocar para verde outline
6. **TOTAL Diurno/Noturno** (linha 348): separar em duas linhas com "Diurno:" em vermelho e "Noturno:" abaixo

