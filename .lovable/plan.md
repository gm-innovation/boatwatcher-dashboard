

## Corrigir `normalizeName`: preposições em minúsculas

### Problema

A função atual capitaliza todas as palavras, incluindo preposições e artigos ("De", "Em", "Do", "Da", "E", etc.), quando deveriam ficar em minúsculas em português.

### Alteração

**Arquivo:** `src/lib/utils.ts`, função `normalizeName`

Adicionar um `Set` de palavras que devem permanecer em minúsculas (preposições, artigos, conjunções) e só capitalizar a primeira palavra da frase:

```typescript
export function normalizeName(text: string | null | undefined): string {
  if (!text) return '-';
  const romanNumerals = new Set(['I','II','III','IV','V','VI','VII','VIII','IX','X']);
  const lowerWords = new Set([
    'de','do','da','dos','das','e','em','no','na','nos','nas',
    'por','para','com','sem','sob','sobre','entre','até','ao','aos','à','às',
  ]);
  return text.split(/\s+/).map((word, i) => {
    const upper = word.toUpperCase();
    if (romanNumerals.has(upper)) return upper;
    const lower = word.toLowerCase();
    if (i > 0 && lowerWords.has(lower)) return lower;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}
```

Resultados:
- "TÉCNICO EM ELETRÔNICA" → "Técnico em Eletrônica"
- "ANALISTA DE INOVAÇÃO" → "Analista de Inovação"
- "FASE II" → "Fase II"
- "DE SOUZA" (início) → "De Souza" (primeira palavra sempre capitalizada)

