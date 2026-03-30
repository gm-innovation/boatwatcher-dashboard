

## Corrigir exibição da logo na tabela de clientes

O Avatar circular (`rounded-full`) está cortando a logo do cliente. Logos de empresas geralmente são retangulares e não devem ser exibidas em formato circular.

### Alteração

**`src/components/admin/ClientsManagement.tsx`** linhas 355-365:

Substituir o componente `Avatar` por uma `div` simples com `img`, mantendo o fallback com ícone:

- Quando há logo: exibir `<img>` com `h-10 object-contain` (sem recorte circular)
- Quando não há logo: manter o ícone `Building2` dentro de uma div com fundo `bg-muted rounded`

