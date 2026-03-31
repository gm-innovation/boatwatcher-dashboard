

## Reformular Tela de Acesso — Sem Seletor de Terminal

### Mudança principal
Remover o `AccessPointSelector` da tela de acesso (`AccessControl.tsx`). O terminal ativo será carregado automaticamente da base de dados — busca o primeiro (ou único) terminal com `is_active = true`. Se nenhum estiver ativo, exibe mensagem orientando a configurar na área administrativa.

### Alterações em `src/pages/AccessControl.tsx`

1. **Remover** o import e uso de `AccessPointSelector`
2. **Adicionar** query automática ao montar a página:
   - Busca `manual_access_points` com `is_active = true`, limit 1
   - Join com `companies` para obter logo e nome do cliente
   - Seta `selectedPoint` automaticamente com o resultado
3. **Header redesenhado**: exibir logo do cliente, nome do terminal, localização — sem dropdown
4. **Estado vazio**: se não houver terminal ativo, mostrar "Nenhum terminal configurado. Configure na área administrativa."
5. **Teclado numérico virtual**: criar componente `NumericKeypad.tsx` com grid 3x4 (1-9, limpar, 0, confirmar) conforme os prints de referência
6. **Campo de código**: display numérico grande + link "Usar Câmera" para QR
7. **Botão "Verificar Acesso"**: busca trabalhador no cache pelo código digitado

### Novo arquivo: `src/components/access-control/NumericKeypad.tsx`
Componente do teclado numérico virtual com callbacks `onDigit`, `onClear`, `onConfirm`.

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/pages/AccessControl.tsx` | Reescrever — auto-load terminal ativo, layout com teclado numérico |
| `src/components/access-control/NumericKeypad.tsx` | Criar — teclado virtual |
| `src/components/access-control/AccessPointSelector.tsx` | Sem alteração (mantém para uso futuro na config) |

