
Objetivo: corrigir a sincronização de fotos para que o agente Python não tente baixar do bucket privado de forma incorreta e passe a consumir URLs assinadas válidas.

Diagnóstico
- O bucket `worker-photos` existe e é privado; então o agente não deve montar URL direta de bucket nem tratar `photo_url` como URL pública.
- Hoje os trabalhadores armazenam `photo_url` no formato persistente `storage://worker-photos/...`.
- No backend, a rota `download-workers` já tenta gerar `photo_signed_url`, mas há um bug: ela remove apenas o prefixo `worker-photos/`, enquanto o valor real começa com `storage://worker-photos/...`.
- Resultado: a URL assinada pode ser gerada com caminho inválido, e um agente legado pode cair no `photo_url` bruto e tentar acessar um “bucket” inexistente.

O que implementar
1. Corrigir a geração de URL assinada no backend
- Ajustar `supabase/functions/api/index.ts` para extrair corretamente o caminho de:
  - `storage://worker-photos/...`
  - `worker-photos/...`
  - URLs antigas já assinadas/públicas
- Aplicar a mesma correção nos dois pontos:
  - `/notifications/download-workers`
  - enriquecimento de `sync_users`

2. Padronizar o contrato entregue ao agente
- Garantir que `download-workers` sempre retorne:
  - `photo_url`: referência persistente
  - `photo_signed_url`: URL temporária pronta para download
- Se a foto não puder ser resolvida, retornar `photo_signed_url: null` com log claro no backend.

3. Ajustar o agente Python para usar a fonte certa
- Atualizar o script do agente para:
  - priorizar `photo_signed_url` ao baixar a imagem
  - nunca tentar baixar usando `storage://...`
  - não montar URL manual para o bucket privado
- Manter `photo_url` apenas como referência persistente local, não como URL de download.

4. Melhorar logs de diagnóstico
- Adicionar logs claros no backend e no agente com:
  - worker id
  - valor original de `photo_url`
  - caminho resolvido para assinatura
  - presença/ausência de `photo_signed_url`

Validação esperada
- `download-workers` passa a retornar `photo_signed_url` válido para trabalhadores com foto.
- O agente Python baixa a imagem pela URL assinada sem erro 404.
- Nenhum acesso direto ao bucket privado é mais tentado.

Arquivos principais
- `supabase/functions/api/index.ts`
- script Python do agente que consome `download-workers` e baixa a foto

Observação técnica
- Não vejo necessidade de mudar banco, bucket ou permissões agora.
- O problema é de compatibilidade entre o formato persistido (`storage://...`) e a lógica de assinatura/consumo no backend e no agente.
