

## Por que os dados diferem entre Web e Desktop

### Causa raiz

O Desktop tem dois comportamentos que geram divergência:

1. **Agentes**: No Desktop, o hook `useLocalAgents` **nunca consulta a nuvem** — ele fabrica um "pseudo-agente" a partir do status local (`localAgent.getStatus()`), com nome fixo "Agente local do servidor", sem versão, sem IP real. Por isso o agente real "Engenharia01" (que existe na nuvem) não aparece.

2. **Dispositivos**: O hook `fetchDevices` usa `executeWithDesktopFallback`, que prioriza o SQLite local (`localDevices.list()`). Se a sincronização não trouxe as últimas alterações de nome/configuração (ex: "Bordo" vs "Engenharia - Entrada"), o Desktop mostra dados desatualizados.

3. **Vinculação de agente nos dispositivos**: No Desktop, ao editar um dispositivo, o dropdown de agentes mostra o pseudo-agente (`id: 'local-runtime-agent'`), que não existe na nuvem. Na web, mostra o agente real "Engenharia01".

```text
Web:     useLocalAgents → Supabase → "Engenharia01" (real)
Desktop: useLocalAgents → pseudo-agent → "Agente local do servidor" (fabricado)

Web:     fetchDevices → Supabase → nomes atualizados
Desktop: fetchDevices → SQLite local → nomes potencialmente desatualizados
```

### Solução

#### 1. `useLocalAgents` — Desktop deve exibir agentes da nuvem + status local

No modo Desktop com servidor local disponível, consultar **ambas** as fontes:
- Buscar agentes reais da nuvem (`supabase.from('local_agents')`)
- Enriquecer o agente correspondente com status local (running/stopped, sync status, pendências)
- Remover a criação do pseudo-agente

Isso garante que nomes, versões, IPs e tokens sejam os mesmos nas duas plataformas.

#### 2. `useControlID` (useDevices) — forçar cloud no Desktop para admin

Para a aba de **gerenciamento** de dispositivos (admin), usar `forceCloud: true` para garantir que os nomes e configurações sejam os da nuvem. O SQLite local continua sendo usado para operações em tempo real (captura de eventos, controle de acesso).

Adicionar um parâmetro opcional `forceCloud` ao `fetchDevices` e usá-lo no `DeviceManagement`:

```typescript
export async function fetchDevices(projectId?: string, forceCloud = false) {
  return executeWithDesktopFallback(
    () => localDevices.list(projectId),
    async () => { /* supabase query */ },
    forceCloud,
  );
}
```

No `useDevices`, aceitar a opção e passá-la:
```typescript
export const useDevices = (projectId?: string | null, options?: { forceCloud?: boolean }) => {
  queryFn: async () => {
    const data = await fetchDevices(projectId || undefined, options?.forceCloud);
    ...
  }
};
```

#### 3. `DeviceManagement.tsx` — usar cloud para gestão

Passar `{ forceCloud: true }` na chamada do `useDevices` dentro do componente de gerenciamento administrativo, garantindo paridade visual com a web.

### Arquivos modificados
- `src/hooks/useLocalAgents.ts` — remover pseudo-agente, consultar nuvem + enriquecer com status local
- `src/hooks/useDataProvider.ts` — `fetchDevices` aceitar `forceCloud`
- `src/hooks/useControlID.ts` — `useDevices` aceitar opção `forceCloud`
- `src/components/devices/DeviceManagement.tsx` — passar `forceCloud: true`

### Resultado esperado
Ambas as plataformas exibirão os mesmos agentes e dispositivos nas telas administrativas, com o Desktop adicionando informações de status local (running/stopped, sync) como enriquecimento visual.

