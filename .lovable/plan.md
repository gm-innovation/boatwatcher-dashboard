

## Corrigir localização na tabela "Trabalhadores a Bordo" no Desktop

### Problema
A query `getWorkersOnBoard` no Desktop (`electron/database.js`, linha 1157) usa `device_name` como localização, retornando o nome do dispositivo (ex: "Engenharia - Entrada"). A versão Web usa `configuration.access_location` do dispositivo para exibir "Bordo" ou "Dique".

### Solução
Alterar a query SQL do `getWorkersOnBoard` para fazer JOIN com a tabela `devices` e ler o campo `configuration`, extraindo `access_location` para determinar a localização correta.

### Alteração

**`electron/database.js`** — método `getWorkersOnBoard`:

1. Adicionar JOIN com `devices` na CTE `first_entries` para trazer `d.configuration`
2. No `.map()` final, parsear `configuration` e usar `access_location` (default `'bordo'`) para gerar o label "Bordo" ou "Dique", em vez de usar `device_name`

```javascript
// Na query SQL, adicionar na seleção de first_entries:
// JOIN devices d ON al.device_id = d.id
// SELECT ... d.configuration as device_configuration

// No .map() final (linha 1157):
const config = safeParseJson(r.device_configuration, {});
const accessLocation = config.access_location || 'bordo';
const locationLabel = accessLocation === 'dique' ? 'Dique' : 'Bordo';
return {
  ...
  location: locationLabel,  // era: r.device_name
};
```

| Arquivo | Mudança |
|---|---|
| `electron/database.js` | JOIN com `devices` + usar `configuration.access_location` em vez de `device_name` |

