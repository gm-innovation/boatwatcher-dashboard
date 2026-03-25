

## Correção: Campo de direção no agente local

### Problema confirmado
Em `electron/agent.js` linha 217, o código usa `device.configuration?.direction` mas o front-end salva como `passage_direction`. Resultado: o fallback de direção nunca funciona no agente local.

### Esclarecimento sobre ControlID e catracas
Você tem razão — quando o dispositivo ControlID está conectado a uma catraca, o firmware **consegue sim** distinguir entrada de saída pelo sentido de giro. Nesse caso o campo `event.direction` virá preenchido no payload do evento. A nossa lógica já trata isso corretamente: `event.direction` tem prioridade, e o `passage_direction` configurado no front só entra como **fallback** quando o hardware não informa. Portanto:
- Com catraca → o dispositivo informa a direção → sistema usa direto
- Sem catraca (leitor facial standalone) → sistema usa `passage_direction` do config

### Correção necessária

**Arquivo: `electron/agent.js` (linha 216-218)**

Trocar:
```javascript
const direction = event.direction || 
  (device.configuration?.direction) || 
  'unknown';
```

Por:
```javascript
const direction = event.direction || 
  (device.configuration?.passage_direction) || 
  'unknown';
```

### Arquivos alterados
- `electron/agent.js` — única alteração, uma linha

