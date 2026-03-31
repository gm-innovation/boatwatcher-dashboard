

## Melhorias na Tela de Acesso

### Alterações

#### 1. `src/components/access-control/WorkerCard.tsx`
- Aumentar avatar para `h-24 w-24` e nome para `text-xl`
- Remover linha "Documento" — exibir "Função" no lugar
- Aceitar prop `borderStatus: 'granted' | 'blocked' | 'pending' | null` para borda colorida do card:
  - `granted` → `border-green-500`
  - `blocked` → `border-red-500`
  - `pending` → `border-yellow-500`
- Aplicar `border-2` com a cor correspondente

#### 2. `src/components/access-control/AccessConfirmation.tsx`
- Botão SAÍDA: mudar de `bg-purple-700` para `bg-red-600 hover:bg-red-700`

#### 3. `src/pages/AccessControl.tsx`
- **Logo do cliente**: a query já busca `logo_url_light` mas o URL pode ser um path de storage privado. Usar `useResolvedUrl` para resolver a URL da logo antes de renderizar
- **Beep sonoro**: ao confirmar acesso (entrada/saída), tocar um beep usando `AudioContext` (Web Audio API) — som curto de ~200ms a 800Hz
- Passar `borderStatus` para `WorkerCard` baseado no status do acesso:
  - Após confirmar → `'granted'`
  - Antes de confirmar → `null` (ou futuramente lógica de bloqueio)
- Reduzir padding do header para melhor ocupação de espaço

#### 4. Beep helper
Criar função inline `playBeep()` em `AccessControl.tsx` usando `AudioContext` — sem dependência externa.

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/pages/AccessControl.tsx` | Editar — resolver logo, beep, borderStatus, padding |
| `src/components/access-control/WorkerCard.tsx` | Editar — avatar maior, remover documento, borda colorida |
| `src/components/access-control/AccessConfirmation.tsx` | Editar — botão saída vermelho |

