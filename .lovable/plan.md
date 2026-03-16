
Objetivo: alinhar a integração do equipamento com a documentação do ControlID para que a foto de passagem volte a ser recebida e exibida.

O que encontrei
- Hoje não existe handler para `POST /api/notifications/access_photo` em `supabase/functions/api/index.ts`.
- O backend atual só trata:
  - `/notifications/device_is_alive`
  - `/notifications/dao`
  - `/notifications/door`
  - `/notifications/download-workers`
  - `/notifications/poll`
- Portanto, se o equipamento estiver seguindo a documentação e enviando a imagem para `/api/notifications/access_photo`, a requisição hoje cai em rota desconhecida.
- Há também uma segunda integração em `supabase/functions/controlid-webhook/index.ts`, mas ela espera o campo `photo`, não `access_photo`, e usa outra URL base.
- A tela/instruções do dispositivo (`src/components/devices/DeviceSetupInstructions.tsx`) ainda orienta usar a URL da função `controlid-webhook`, o que pode estar divergindo da arquitetura atual baseada na função `api`.
- O sistema exibe foto a partir de `photo_capture_url`, mas hoje:
  - em `/notifications/dao` a foto nem é salva;
  - em `controlid-webhook` ela seria salva crua em `photo_capture_url`, sem normalização garantida para renderização.

Plano de correção
1. Padronizar a integração na função `api`
- Adicionar suporte explícito ao endpoint `POST /notifications/access_photo`.
- Mapear o payload exatamente como na documentação:
  - `device_id`
  - `time`
  - `portal_id`
  - `identifier_id`
  - `event`
  - `user_id`
  - `access_photo`

2. Persistir a foto corretamente
- Converter `access_photo` em um formato utilizável pelo frontend.
- Preferência: salvar como `data:image/jpeg;base64,...` em `photo_capture_url` para a imagem renderizar imediatamente no feed atual.
- Vincular a foto ao dispositivo e ao trabalhador usando a mesma lógica de resolução já usada em `/notifications/dao`.

3. Ajustar compatibilidade entre eventos
- Revisar `/notifications/dao` para continuar recebendo eventos normais sem foto.
- Se necessário, compartilhar a mesma função de normalização entre `/dao` e `/access_photo`, para evitar registros inconsistentes.
- Garantir leitura correta de `event` para inferir direção/status quando o payload vier no formato do ControlID.

4. Corrigir a documentação interna da UI
- Atualizar `src/components/devices/DeviceSetupInstructions.tsx` para instruir o cliente com os endpoints corretos:
  - eventos
  - heartbeat
  - upload de foto
- Incluir orientação de habilitar:
  - `set_configuration -> monitor.enable_photo_upload = 1`

5. Melhorar suporte operacional
- Adicionar no backend de controle do dispositivo uma ação para `get_configuration`, porque hoje existe `set_configuration` mas não há leitura do estado atual.
- Opcionalmente mostrar no painel se o envio de foto está habilitado no equipamento.

Detalhes técnicos
- Arquivos principais envolvidos:
  - `supabase/functions/api/index.ts`
  - `supabase/functions/controlid-api/index.ts`
  - `src/components/devices/DeviceSetupInstructions.tsx`
  - possivelmente `src/components/dashboard/RecentActivityFeed.tsx` se precisarmos tratar fallback de imagem
- Inconsistências atuais com a documentação:
  - falta `POST /notifications/access_photo`
  - nome de campo esperado pelo webhook atual é `photo`, mas a documentação usa `access_photo`
  - instruções da UI apontam para outra função
  - não há verificação/configuração visível de `enable_photo_upload`
- Resultado esperado após a correção:
  - o equipamento envia a foto no endpoint correto
  - a foto é salva no log de acesso
  - o feed e demais telas passam a exibir a imagem da passagem

Validação depois da implementação
- Confirmar que `POST /notifications/access_photo` retorna 200
- Confirmar que o log salvo em `access_logs.photo_capture_url` contém imagem válida
- Confirmar que a foto aparece no feed de atividade recente
- Confirmar que as instruções do dispositivo mostram os endpoints corretos
