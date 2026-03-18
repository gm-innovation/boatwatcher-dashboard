

## Exibir UUID do dispositivo no card

Adicionar o `device.id` (UUID) no card do dispositivo em `DeviceManagement.tsx`, logo abaixo do Serial, com um botão de copiar para facilitar o uso no Local Server.

### Alteração

**Arquivo: `src/components/devices/DeviceManagement.tsx`**

- Importar `Copy` do lucide-react
- Após a linha do Serial (linha 202), adicionar uma div mostrando o UUID com fonte mono e um botão de copiar:

```tsx
<div className="text-sm text-muted-foreground flex items-center gap-2">
  <span className="font-medium">ID:</span>
  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono select-all">{device.id}</code>
  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText(device.id); toast({ title: 'ID copiado!' }); }}>
    <Copy className="h-3 w-3" />
  </Button>
</div>
```

Apenas isso. Uma linha nova no card, sem mudanças estruturais.

