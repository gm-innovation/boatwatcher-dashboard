

## Problema

O `server.yml` gerado no release v1.2.2 aponta para `dock-check-desktop-Setup-1.2.2.exe` em vez de `DockCheck-Local-Server-Setup-1.2.2.exe`. O build do Desktop, executado por último no workflow, sobrescreve o `server.yml` criado pelo build do Local Server.

## Correção

### 1. Inverter a ordem dos builds no workflow

No arquivo `.github/workflows/desktop-release.yml`, trocar a ordem: **Desktop primeiro, Local Server por último**. Assim o `server.yml` final será o correto (gerado pelo Local Server), e o `latest.yml` do Desktop também ficará correto (não é sobrescrito pelo Local Server).

```text
Ordem atual (com bug):
  1. Build Local Server  → gera server.yml ✓
  2. Build Desktop       → sobrescreve server.yml ✗

Ordem corrigida:
  1. Build Desktop       → gera latest.yml ✓
  2. Build Local Server  → gera server.yml ✓
```

### 2. Alteração no arquivo

**`.github/workflows/desktop-release.yml`** — mover os steps de "Build and publish Desktop" para ANTES dos steps de "Build and publish Local Server":

```yaml
steps:
  # ... checkout, node, install, prepare assets ...
  
  - name: Build and publish Desktop release
    run: npm run build:electron:publish

  - name: Build and publish Local Server release
    run: npm run build:local-server:publish

  - name: Verify Local Server update artifacts
    # ... verificação existente ...
```

### 3. Após a correção

- Deletar o release v1.2.2 no GitHub
- Criar nova tag v1.2.3 para disparar o workflow corrigido
- Verificar que `server.yml` agora referencia `DockCheck-Local-Server-Setup-1.2.3.exe`
- Instalar manualmente o `.exe` correto na máquina

