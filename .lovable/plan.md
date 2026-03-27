

# Salvar Plano do Módulo de Visão Industrial

O arquivo `.lovable/plan.md` atualmente contém o plano do hotfix da tela branca (já implementado). Vou substituí-lo pelo plano completo do módulo de Visão Industrial para referência futura.

## Conteúdo a salvar

O plano completo cobrindo:

1. **Arquitetura**: Dois sistemas separados — Vision Server (Python/GPU) e integração no Dock Check (Lovable/Electron)
2. **Lado A (Lovable)**: Tabelas, rotas no Local Server, dashboard React, sync nuvem
3. **Lado B (Python)**: FastAPI + YOLO + ByteTrack, motor de regras, captura RTSP, Docker
4. **Protocolo de integração**: REST + WebSocket entre os dois sistemas
5. **4 fases de implementação**: Estrutura/Dashboard → Vision Server Base → Regras Avançadas → Produção

## Arquivo impactado

- `.lovable/plan.md` — substituir conteúdo atual pelo plano de Visão Industrial

