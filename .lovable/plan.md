

## Plano Completo de Correções — v1.2.0

Peço desculpa por ter descartado os outros pontos. Aqui está o plano consolidado com todas as correções pendentes.

---

### 1. Renomear package name
**Arquivo: `package.json`**
- `"name"` → `"dock-check-desktop"`
- `"version"` → `"1.2.0"`

### 2. Preparar ícone no workflow
**Arquivo: `.github/workflows/desktop-release.yml`**
- Adicionar step antes dos builds para copiar `public/favicon-512.png` → `build/icon.png`

```yaml
- name: Prepare build assets
  run: |
    mkdir build
    copy public\favicon-512.png build\icon.png
  shell: cmd
```

### 3. Corrigir publish do Local Server

**Problema:** O `electron-builder.server.yml` tem `publish` hardcoded apontando para `gm-innovation/boatwatcher-dashboard`. Quando o build roda com `--config electron-builder.server.yml --config electron-builder.release.yml`, o segundo config sobrescreve o `publish` do primeiro com `${env.GH_OWNER}` e `${env.GH_REPO}`. Isso está correto **se** as env vars estiverem definidas no workflow — e elas estão (`GH_OWNER` e `GH_REPO` são definidas no job).

Porém, o `electron-builder.server.yml` tem um `publish` redundante que pode causar confusão. Vou removê-lo para que apenas o `electron-builder.release.yml` controle a publicação (mesmo comportamento do Desktop).

**Arquivo: `electron-builder.server.yml`**
- Remover o bloco `publish:` (linhas 51-57), pois já é fornecido pelo `electron-builder.release.yml`

### 4. Garantir que ambos os artifacts apareçam no mesmo Release

O Desktop gera `Dock Check Desktop Setup X.Y.Z.exe` + `latest.yml`. O Local Server gera `DockCheck-Local-Server-Setup-X.Y.Z.exe` + `latest.yml`. Ambos publicam `latest.yml` — o segundo sobrescreve o primeiro.

**Correção:** O Local Server precisa de um `artifactName` diferenciado para o `latest.yml`. O `electron-builder` já gera arquivos `latest.yml` separados por `appId` quando os `artifactName` são distintos. O Local Server já tem `artifactName` customizado no `.exe`, mas o `latest.yml` precisa ser verificado.

Na verdade, o `electron-builder` gera um `latest.yml` por build. Como ambos os builds rodam sequencialmente no mesmo job e publicam para o mesmo Release, o segundo `latest.yml` sobrescreve o primeiro. Isso significa que o auto-updater do Desktop ou do Local Server vai apontar para o artifact errado.

**Correção definitiva:** Separar os `latest.yml` usando `artifactName` no `electron-builder.server.yml` para gerar um arquivo de metadados com nome diferente. Porém, o `electron-updater` por padrão busca `latest.yml` — não suporta nomes customizados sem configuração adicional.

**Solução mais simples:** Adicionar `updaterCacheDirName` diferente em cada config para que não colidam, e usar `artifactName` no Desktop também para diferenciá-los. Entretanto, o `latest.yml` é sempre `latest.yml`.

**Solução prática:** O `electron-builder` suporta um `channel` que muda o nome do arquivo de update de `latest.yml` para `{channel}.yml`. Vou configurar:
- Desktop: channel `stable` (gera `stable.yml`) — não, o padrão é `latest.yml`
- Local Server: Não alterar — ambos vão gerar `latest.yml` mas com conteúdo diferente

Melhor abordagem: como o segundo build (`Local Server`) sobrescreve o `latest.yml` do Desktop, vou **inverter a ordem** no workflow para que o Desktop rode por último, ou melhor, configurar um `artifactName` no `win` do Desktop que inclua o nome do produto, e usar `publishAutoUpdate: true` separadamente.

**Decisão final:** A forma mais limpa é não mexer nisso agora — o `electron-updater` usa o `appId` e o `artifactName` para identificar o artifact correto dentro do `latest.yml`. Se ambos publicam para o mesmo Release, o `latest.yml` final contém apenas o último build. Isso **é** o problema.

**Correção:** Adicionar `artifactName` no Desktop e usar nomes diferentes de `yml` via a opção `channel` do `electron-builder`:

**Arquivo: `electron-builder.yml`** — Adicionar:
```yaml
win:
  artifactName: DockCheck-Desktop-Setup-${version}.${ext}
```

**Arquivo: `electron-builder.server.yml`** — Já tem `artifactName` customizado.

Para o `latest.yml`, vou configurar os builds para rodar em **jobs separados** para que cada um crie seu próprio Release asset sem sobrescrever. Na verdade, o `--publish always` com `electron-builder` faz upload incremental — ele adiciona assets ao Release existente. O problema é que ambos geram um arquivo chamado `latest.yml`.

**Solução definitiva:** Usar a propriedade `channel` do nsis:
- Desktop: sem channel (padrão = `latest.yml`)  
- Local Server: `channel: server` → gera `server.yml`

Mas o `electron-updater` no Local Server precisa ser configurado para buscar `server.yml` em vez de `latest.yml`. Isso requer `autoUpdater.channel = 'server'` no código.

---

### Resumo das alterações

| Arquivo | Mudança |
|---|---|
| `package.json` | `name` → `dock-check-desktop`, `version` → `1.2.0` |
| `.github/workflows/desktop-release.yml` | Adicionar step "Prepare build assets" para copiar ícone |
| `electron-builder.yml` | Adicionar `artifactName` no `win` |
| `electron-builder.server.yml` | Remover bloco `publish` redundante; adicionar `channel: server` no `nsis` |
| `electron/local-server-main.js` | Adicionar `autoUpdater.channel = 'server'` para buscar `server.yml` |

### Após o commit
```powershell
git pull
git tag v1.2.0
git push origin v1.2.0
```

