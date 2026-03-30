

## Mapa do Brasil com Zoom, Modal Expandido e Marcadores Pulsantes

### Componentes

**1. `src/components/devices/BrazilMap.tsx`** — Componente principal

- SVG inline simplificado do contorno do Brasil (~5KB path)
- Dicionário de ~20 cidades/portos mapeando `location` normalizado → `{x, y}` no viewBox
- Marcadores pulsantes (`<circle>` + CSS `animate-ping`) coloridos por health:
  - Verde: todos online | Amarelo: parcial | Vermelho: todos offline
- Tamanho proporcional ao número de dispositivos
- Tooltip no hover com nome do projeto, dispositivos online/total
- Props: `projects`, `devicesByProject`, `onExpandClick`
- Versão compacta para o dashboard (altura fixa ~250px)

**2. `src/components/devices/BrazilMapModal.tsx`** — Modal com zoom

- Usa `Dialog` (max-w-4xl ou full-screen) para exibir o mapa em tamanho grande
- **Zoom via scroll do mouse**: controla o `viewBox` do SVG para fazer zoom in/out
  - `onWheel` → ajusta escala (min 0.5x, max 5x)
  - Pan com drag (mousedown + mousemove) para navegar no mapa ampliado
- Ao dar zoom, os marcadores próximos se separam visualmente, resolvendo sobreposição
- Marcadores mantêm tamanho visual constante (compensam o zoom via `r={baseSize / scale}`)
- Tooltip mais detalhado no modal: nome, location, contagem, uptime %
- Botões de controle: zoom +, zoom −, resetar vista
- Botão de fechar padrão do Dialog

**3. Integração em `ConnectivityDashboard.tsx`**

- Renderizar `<BrazilMap>` acima dos project cards com botão "Expandir" (ícone `Maximize2`)
- Ao clicar em expandir, abre `<BrazilMapModal>`
- Dados já disponíveis no componente (projects, devices) passados via props

### Detalhes técnicos

- Zoom implementado com estado `{ scale, translateX, translateY }` controlando o `viewBox` do SVG
- `viewBox` dinâmico: `x y width height` onde width/height = baseSize/scale e x,y deslocados pelo pan
- Sem dependências externas — SVG puro + CSS + estado React
- Matching de location: `normalize(str)` remove acentos, lowercase, e busca no dicionário; fallback para centro do mapa

```text
Dashboard:
┌─ Mapa de Operações ─────── [⤢ Expandir]─┐
│        ╭──╮                               │
│       ╱    ╲   ● Recife                   │
│      │      │                             │
│       ╲    ╱  ●● Santos/Rio               │
│        ╰──╯                               │
└───────────────────────────────────────────┘

Modal (expandido, com zoom):
┌─────────────────────────────────────────────────┐
│  Mapa de Operações               [−] [+] [↺] X │
│  ┌─────────────────────────────────────────────┐│
│  │                                             ││
│  │         (SVG ampliado, pan+zoom)            ││
│  │              ●  Santos                      ││
│  │           ●  Guarujá                        ││
│  │                                             ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

