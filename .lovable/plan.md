

# Corrigir calendário fantasma e logo do cliente na lista de projetos

## Problemas identificados

### 1. Calendário fantasma na tabela de projetos
Em `src/components/admin/ProjectsManagement.tsx`, linha 358, o componente `Calendar` (DayPicker completo) está sendo usado no lugar do ícone `CalendarIcon` (lucide). Resultado: um datepicker inteiro renderizado dentro da célula da tabela.

```
// Linha 358 — BUG:
<Calendar className="h-4 w-4" />   ← DayPicker completo

// Deveria ser:
<CalendarIcon className="h-4 w-4" />  ← ícone lucide
```

### 2. Logo do cliente cortada (Avatar circular)
Na mesma tabela (linhas 332-340), a logo do cliente é exibida dentro de um `Avatar` com `rounded-full`, que corta logos retangulares. Trocar por um container retangular com `rounded-md` para preservar a proporção da imagem — conforme a referência visual enviada (image-41.png).

## Alterações

**Arquivo:** `src/components/admin/ProjectsManagement.tsx`

1. **Linha 358**: Trocar `<Calendar className="h-4 w-4" />` por `<CalendarIcon className="h-4 w-4" />`

2. **Linhas 330-342**: Substituir o Avatar circular por um container retangular:
   - Remover `Avatar/AvatarImage/AvatarFallback`
   - Usar `<div>` + `<img>` com `rounded-md` e `object-contain`
   - Manter fallback com ícone `Building2`

