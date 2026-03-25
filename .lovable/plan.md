

## Bug: Dispositivo reconhece mas nega acesso

### Causa raiz

O enrollment em `server/lib/controlid.js` → `enrollUserOnDevice()` faz apenas:
1. Cria o usuário (`create_objects.fcgi` → `users`) ✓
2. Envia a foto (`user_set_image.fcgi`) ✓
3. **Não atribui regra de acesso** ✗

Sem uma `user_access_rules` vinculando o usuário a uma regra de acesso, o dispositivo ControlID reconhece o rosto mas não tem permissão para liberar a porta. Isso é documentado pela ControlID: o usuário precisa de uma regra de acesso (direta ou via grupo) para que o dispositivo autorize a passagem em modo standalone.

### Correção

#### `server/lib/controlid.js` — função `enrollUserOnDevice()`

Adicionar Step 1.5 após criar o usuário: criar um `user_access_rules` vinculando o trabalhador à regra de acesso padrão (id=1, que é a regra "Acesso Livre" pré-configurada nos dispositivos ControlID).

```javascript
// Step 1.5: Assign default access rule to user
await controlIdRequest(device, 'create_objects.fcgi', 'POST', {
  object: 'user_access_rules',
  values: [{
    user_id: controlIdCode,
    access_rule_id: 1,  // Default "Acesso Livre" rule
  }],
});
```

Opcionalmente, permitir configurar o `access_rule_id` via `device.configuration.access_rule_id` para dispositivos com regras personalizadas.

#### `supabase/functions/worker-enrollment/index.ts`

Verificar se o enrollment via nuvem (fila de comandos) também precisa dessa etapa. Se o comando `enroll_worker` é processado pelo servidor local via `agent_commands`, a correção acima já cobre. Caso contrário, replicar a mesma lógica.

### Resultado esperado

Após o enrollment, o usuário terá: cadastro + foto + regra de acesso. O dispositivo reconhecerá E autorizará a passagem.

### Necessidade de re-enrollment

Os trabalhadores já cadastrados (como Alexandre Silva) precisarão ser re-enrollados para que a regra de acesso seja criada. Isso pode ser feito editando o trabalhador ou disparando o enrollment manualmente.

### Arquivos afetados
- `server/lib/controlid.js` — adicionar criação de `user_access_rules` no enrollment

