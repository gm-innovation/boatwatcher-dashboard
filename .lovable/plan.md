

## Aumentar o mapa e adicionar tema dark

### Alterações

#### 1. Aumentar altura do mapa (`BrazilMap.tsx`)
- Alterar `height` de `compact ? 200 : 280` para `compact ? 260 : 420`
- Isso dará mais espaço para visualização no card do dashboard

#### 2. Tile layer dark mode (`BrazilMap.tsx` + `BrazilMapModal.tsx`)
- Detectar o tema atual via `document.documentElement.classList.contains('dark')`
- Usar tile dark do CartoDB: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` quando em dark mode
- Manter o tile padrão do OpenStreetMap para light mode
- Reagir a mudanças de tema trocando o tile layer dinamicamente

#### 3. Popup styling para dark mode
- Ajustar as cores inline dos popups para funcionar em ambos os temas (texto branco no dark, texto escuro no light)

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/components/devices/BrazilMap.tsx` | Aumentar altura, tile dark, popup dark |
| `src/components/devices/BrazilMapModal.tsx` | Tile dark, popup dark |

