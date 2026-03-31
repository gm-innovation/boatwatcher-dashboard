

## Corrigir layout maximizado: mapa na coluna direita + lista com scroll

### Problema
No modo maximizado do Monitoramento, o mapa não aparece. Além disso, a lista de dispositivos ocupa todo o espaço vertical sem limitação.

### Solução

Modificar o bloco maximizado (linhas 802-827) em `src/components/devices/ConnectivityDashboard.tsx`:

1. **Lista de dispositivos com altura limitada e scroll** — passar uma classe de altura máxima (ex: `max-h-[300px]`) ao `renderDeviceTable` para que a tabela fique dentro de uma box com barra de rolagem, exibindo apenas alguns dispositivos por vez.

2. **Mapa na coluna da direita** — adicionar `<BrazilMap>` e `<BrazilMapModal>` logo abaixo da lista de dispositivos na coluna direita, em modo compacto.

### Alteração

**Arquivo:** `src/components/devices/ConnectivityDashboard.tsx`

O bloco maximizado (linhas 817-823) passará de:

```tsx
{/* Right column */}
<div className="flex flex-col gap-3 min-h-0 overflow-hidden">
  <div className="flex-1 min-h-0 flex flex-col">
    {renderDeviceTable()}
  </div>
  {renderAlerts()}
</div>
```

Para:

```tsx
{/* Right column */}
<div className="flex flex-col gap-3 min-h-0 overflow-auto">
  {renderDeviceTable('max-h-[300px]')}
  <BrazilMap 
    projects={mapProjectData} 
    onExpandClick={() => setMapModalOpen(true)} 
    compact 
  />
  <BrazilMapModal 
    open={mapModalOpen} 
    onOpenChange={setMapModalOpen} 
    projects={mapProjectData} 
  />
  {renderAlerts()}
</div>
```

Isso coloca a lista de dispositivos em uma box com scroll de ~300px, seguida do mapa compacto e dos alertas, tudo na coluna direita com scroll geral caso o conteúdo exceda a altura disponível.

