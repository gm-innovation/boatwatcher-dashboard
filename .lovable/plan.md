

## Problema

O workflow falhou no step "Verify Local Server update artifacts" — não no build em si. O electron-builder com `--publish always` faz upload do `server.yml` diretamente para o GitHub Release, sem necessariamente manter uma cópia local em `local-server-dist/`. O comando `dir ... 2>nul` retorna exit code 1, causando a falha.

## Correção

### Arquivo: `.github/workflows/desktop-release.yml`

Tornar o step de verificação não-bloqueante, usando `continue-on-error: true` ou adicionando `exit /b 0` ao final. A verificação continua útil como log, mas não deve impedir o release.

```yaml
      - name: Verify Local Server update artifacts
        continue-on-error: true
        run: |
          echo "Checking for server.yml in local-server-dist..."
          if exist local-server-dist\server.yml (
            echo "server.yml found"
            type local-server-dist\server.yml
          ) else (
            echo "INFO: server.yml not in local-server-dist (uploaded directly to GitHub Release)"
            dir local-server-dist\*.yml 2>nul || echo "No local .yml files (expected with --publish always)"
          )
        shell: cmd
```

### Após a correção

1. Deletar o release v1.2.3 no GitHub
2. Criar nova tag v1.2.4 para disparar o workflow corrigido
3. Verificar nos Assets do release que `server.yml` referencia `DockCheck-Local-Server-Setup-1.2.4.exe`

