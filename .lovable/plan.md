

## Painel de Monitoramento — Tela Cheia + Cores + Espaço Total

### Problema
O `MainLayout` aplica `max-w-7xl mx-auto px-4` em todo conteúdo, limitando a largura útil. O dashboard de monitoramento precisa ocupar 100% da tela (horizontal e vertical) para funcionar como um centro de controle real.

### Alterações

**1. `src/components/devices/ConnectivityDashboard.tsx`** — estado `isMaximized` local:

- **Modo maximizado**: renderiza um overlay `fixed inset-0 z-[100] bg-background` que cobre tudo (header, sidebar, abas), usando `w-full h-screen p-4` — sem `max-w`, sem margem lateral
- **Layout interno no fullscreen**: grid de 2 colunas (`grid-cols-[1fr_1fr]`) com altura fixa distribuída via flexbox:
  - **Coluna esquerda**: Cards resumo (4 em linha) + gráfico de barras + gráfico de rosca lado a lado
  - **Coluna direita**: Tabela de dispositivos com `flex-1 overflow-auto` + alertas no rodapé
- **Header do monitor**: barra superior com indicador pulsante, status, timestamp, botões refresh e minimizar
- **Escape** fecha o modo maximizado

- **Cores vibrantes hardcoded**:
  - Online: `#22c55e` (verde) nos gráficos, bars, dots, badges
  - Offline: `#ef4444` (vermelho)
  - Parcial: `#eab308` (amarelo)
  - Cards com ícones em círculos coloridos (`bg-green-100 dark:bg-green-900/30`, etc.)
  - Progress bars com cor dinâmica baseada na porcentagem

- **Modo normal** (não maximizado): manter layout atual mas com cores corrigidas. Continua dentro do `max-w-7xl` do MainLayout.

**2. `src/components/layouts/MainLayout.tsx`** — nenhuma alteração necessária (o overlay `fixed` do dashboard já ignora o container pai).

### Layout maximizado

```text
┌─ ● Sistema Operacional ── 15s ── [↻ Refresh] [✕ Minimizar] ──┐
│                                                                 │
│  ┌────┬────┬────┬────┐  ┌─ Todos os Dispositivos ─────────────┐│
│  │Proj│Disp│Agnt│Alrt│  │ ● Leitor A  192.168.1.10  ProjA 2m ││
│  │ 3  │5/7 │2/3 │ 2  │  │ ● Leitor B  192.168.1.11  ProjA 5m ││
│  └────┴────┴────┴────┘  │ ○ Leitor C  192.168.1.20  ProjB 3h ││
│                          │ ...                                 ││
│  ┌─ Barras ─┐ ┌─Rosca─┐ │                                     ││
│  │██ ProjA  │ │ 🟢 🔴 │ │                                     ││
│  │█░ ProjB  │ │       │ ├─ ⚠ Alertas ─────────────────────────┤│
│  │░░ ProjC  │ │       │ │ • Leitor C (ProjB) offline 3h       ││
│  └──────────┘ └───────┘ │ • Agente (ProjC) nunca visto         ││
│                          └─────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Detalhes técnicos

- `isMaximized` é estado local com `useState(false)`
- Overlay usa `fixed inset-0 z-[100]` — não precisa alterar MainLayout
- Gráficos: `fill="#22c55e"` e `fill="#ef4444"` direto nos `Bar` e `Cell`
- Charts reduzidos para `h-[180px]` no fullscreen
- Tabela com `max-h-none flex-1 overflow-auto` para usar espaço vertical restante
- `useEffect` com listener de `Escape` para sair do fullscreen
- Projetos grid (cards por projeto) ficam ocultos no modo maximizado para caber tudo sem scroll

