

## Situacao

A versao instalada **e** a v1.2.13 (confirmado pelo caminho do .exe nos logs). Porem, a UI mostra "v1.0.0" porque **o codigo que corrigimos** (buscar versao dinamica via IPC) ainda nao foi compilado e distribuido — ele existe apenas no repositorio.

As mudancas pendentes de deploy no Local Server sao:
1. **Versao dinamica na UI** (correcao do v1.0.0 hardcoded)
2. **Polling de comandos a cada 5s** (correcao de latencia de enrollment)
3. **Execucao paralela por dispositivo**

## Plano

**Sim, sera necessario reinstalar uma unica vez** — mas primeiro precisamos gerar o novo instalador:

1. **Bump `package.json`** de `1.2.13` para `1.2.14`
2. Isso dispara o CI (GitHub Actions) para gerar `DockCheck-Local-Server-Setup-1.2.14.exe`
3. O operador baixa e instala por cima (nao precisa desinstalar)
4. A partir da v1.2.14, todas as correcoes estarao ativas e o auto-updater funcionara para versoes futuras

### Alteracao
- `package.json`: `"version": "1.2.13"` → `"1.2.14"`

