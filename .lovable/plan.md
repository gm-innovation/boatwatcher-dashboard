

## Corrigir logo e adicionar header colapsável

### Problema da logo
A seção de logos (linhas 99-111) exibe a logo do **cliente** à esquerda e um placeholder "Sistema" à direita. O correto é: logo do **sistema** à esquerda, sem a logo do cliente nessa seção.

### Plano

**1. Corrigir logo do sistema (`src/components/Header.tsx`)**
- Remover a logo do cliente (lado esquerdo) e o placeholder "Sistema" (lado direito)
- Colocar apenas a logo do sistema no canto esquerdo — usar `localStorage.getItem('company_light')` / `company_dark` conforme o tema (mesma lógica do `SystemSettings.tsx`)
- Se não houver logo configurada, mostrar placeholder "DockCheck" ou texto do sistema

**2. Header colapsável (`src/contexts/ProjectContext.tsx`)**
- Adicionar `isHeaderCollapsed` (boolean) e `toggleHeaderCollapsed` ao contexto

**3. Header colapsável (`src/components/Header.tsx`)**
- Quando colapsado: ocultar seção de navegação (segunda div), manter logo + seletor de projeto numa barra compacta
- Botão `ChevronUp`/`ChevronDown` para alternar
- Transição suave com `transition-all duration-300`

**4. Ajustar padding (`src/components/layouts/MainLayout.tsx`)**
- Consumir `isHeaderCollapsed` do contexto
- Expandido: `pt-40` (atual) → Colapsado: `pt-24` (aprox.)

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/Header.tsx` | Corrigir logo (sistema no lugar do cliente) + toggle de colapso |
| `src/contexts/ProjectContext.tsx` | Adicionar `isHeaderCollapsed` / `toggleHeaderCollapsed` |
| `src/components/layouts/MainLayout.tsx` | Padding dinâmico baseado no estado colapsado |

