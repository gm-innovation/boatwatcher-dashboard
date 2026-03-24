

## Diagnóstico: Local Server .exe ausente do release

O release v1.2.7 contém:
- Desktop exe (109 MB) -- OK
- latest.yml -- OK  
- server.yml (365 bytes) -- metadata uploaded
- **DockCheck-Local-Server-Setup-1.2.7.exe -- AUSENTE**

O `server.yml` foi carregado, mas o `.exe` não. Isso significa que o electron-builder iniciou o processo de publish (criou o yml), mas o empacotamento NSIS do Local Server falhou silenciosamente ou o upload do arquivo grande expirou. O CI mostra "Success" porque o step não retornou exit code != 0.

## Causa raiz provável

O Local Server depende de `better-sqlite3` (módulo nativo C++). O `npmRebuild: true` no `electron-builder.server.yml` tenta recompilar esse módulo para Electron, mas pode falhar silenciosamente no Windows se as ferramentas de compilação (Visual Studio Build Tools, Python) não estiverem configuradas corretamente no runner.

## Plano de correção

### 1) Adicionar verificação obrigatória pós-build do Local Server
Arquivo: `.github/workflows/desktop-release.yml`

Após o step "Build and publish Local Server release", adicionar um step **obrigatório** (sem `continue-on-error`) que:
- Verifica se `local-server-dist/DockCheck-Local-Server-Setup-*.exe` existe fisicamente
- Se não existir, falha o build com mensagem clara
- Isso impede releases incompletos (com `server.yml` mas sem `.exe`)

### 2) Instalar ferramentas de compilação nativa no CI
Arquivo: `.github/workflows/desktop-release.yml`

Antes do `npm ci`, adicionar step para garantir Visual Studio Build Tools via `npm config set msvs_version` ou usar `windows-latest` que já vem com ferramentas. Alternativamente, adicionar:
```yaml
- name: Setup native build tools
  run: npm install -g node-gyp windows-build-tools
```
Ou forçar rebuild do `better-sqlite3` antes do electron-builder:
```yaml
- name: Rebuild native modules for Electron
  run: npx electron-rebuild -m . -w better-sqlite3
```

### 3) Separar build e upload para diagnóstico
Em vez de `--publish always` (que mistura build + upload), separar em dois passos:
- Build: `npm run build:local-server` (sem publish, gera .exe local)
- Verificar: confirmar que `.exe` existe e tem tamanho razoável (>10MB)
- Upload: fazer upload do `.exe` manualmente via `gh release upload` ou via `actions/upload-release-asset`

Isso dá visibilidade sobre onde exatamente a falha ocorre (build vs upload).

### 4) Corrigir artifactName inconsistente
O Desktop gera `dock-check-desktop-Setup-...` em vez de `DockCheck-Desktop-Setup-...`. Verificar se electron-builder está usando o `name` do `package.json` em vez do `artifactName`. Ajustar para consistência.

## Ação imediata recomendada

Antes de implementar as correções no CI, o operador pode instalar manualmente:
1. Ir ao Actions > build #13 > step "Build and publish Local Server release"
2. Verificar nos logs se o `.exe` foi realmente gerado ou se houve erro de compilação do `better-sqlite3`
3. Se o `.exe` existe no output, o problema é no upload e pode ser resolvido com re-run

## Arquivos afetados
- `.github/workflows/desktop-release.yml` (verificação pós-build, rebuild nativo, separação build/upload)

