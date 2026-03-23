

## Diagnóstico dos 2 Problemas

### Problema 1: Dispositivos desapareceram do Servidor Local
O dashboard mostra sync online e o agente conectado, mas "Nenhum dispositivo configurado". A nuvem tem o dispositivo com `agent_id` correto. Causas prováveis:
- O Servidor Local está rodando **v1.0.0** (visível no print de atualização), ou seja, o código atualizado com as correções de FK e sync resiliente **nunca chegou** ao servidor em produção.
- Se houve reset do banco SQLite local (reinstalação, limpeza de dados), os dispositivos se perderam e a versão antiga do sync pode não estar re-baixando corretamente.
- Mesmo que o sync rode, se o `upsertDeviceFromCloud` da versão antiga falhar silenciosamente (ex: FK de `project_id`), o dispositivo não persiste.

### Problema 2: sha512 checksum mismatch na atualização
O `server.yml` publicado no GitHub Release contém um hash sha512, mas o `.exe` baixado pelo auto-updater tem hash diferente. Isso acontece quando:
- O pipeline foi executado múltiplas vezes e os artefatos ficaram "cruzados" (`.yml` de um build + `.exe` de outro).
- Releases antigos com artefatos parciais poluíram o release target.

---

## Plano de Correção

### 1) Forçar rebuild limpo do release (corrige checksum)
- **Ação manual no GitHub**: Deletar completamente o release `v1.2.7` (incluindo a tag).
- **Puxar o código atualizado** e criar tag nova:
```bash
git pull origin main
git tag v1.2.7
git push origin v1.2.7
```
- O pipeline vai rodar do zero, gerando Desktop `.exe` + `latest.yml` e Local Server `.exe` + `server.yml` **do mesmo build**, garantindo que os checksums alinhem.

### 2) Adicionar verificação de integridade no CI
Arquivo: `.github/workflows/desktop-release.yml`
- Após a publicação do Local Server, adicionar step que lê o `server.yml` gerado, extrai o sha512, e compara com o sha512 real do `.exe` local. Se não bater, falhar o build antes de o release ficar público com dados corrompidos.

### 3) Garantir que o sync baixe dispositivos mesmo em v1.0.0 (fallback)
O Servidor Local instalado está em v1.0.0 e não consegue atualizar. Até a atualização funcionar, o operador pode adicionar manualmente o dispositivo pelo botão "+ Adicionar Dispositivo" no dashboard. Porém, a correção definitiva é garantir que a atualização automática funcione (item 1 acima).

### 4) Adicionar fallback de atualização manual com URL direta
Arquivo: `electron/server-ui.html`
- Na seção de ATUALIZAÇÃO, quando houver erro de checksum ou 404, exibir link direto para download da versão no GitHub Releases (ex: `https://github.com/{owner}/{repo}/releases/latest`), para que o operador possa baixar e reinstalar manualmente enquanto o auto-update não funciona.

---

## Resumo de arquivos
- `.github/workflows/desktop-release.yml` — step de verificação de integridade sha512
- `electron/server-ui.html` — link de fallback para download manual na seção de atualização
- GitHub: deletar release `v1.2.7` e recriar tag para build limpo

