

# Reduzir latência de sincronização dos eventos faciais

## Situação atual

O pipeline de um evento facial até aparecer no dashboard:

```text
Leitor facial → poll do agent (cada 5s) → salva local → fast-lane trigger (500ms–3s) → upload para nuvem → dashboard
```

Tempo total estimado: **5s + 3s = ~8s** no melhor caso, até **10s** no pior.

## O que reduzir

| Parâmetro | Atual | Proposto | Risco |
|-----------|-------|----------|-------|
| `pollIntervalMs` (agent.js) | 5000ms (5s) | 3000ms (3s) | Mínimo — o ControlID suporta polling rápido |
| `_fastLaneThrottleMs` (sync.js) | 3000ms (3s) | 1500ms (1.5s) | Nenhum — throttle apenas evita flood |
| Delay do fast-lane (sync.js) | 500ms | 200ms | Nenhum |

Resultado: pipeline reduzido de **~8s** para **~3.5-5s**.

## Limites seguros

- **Poll < 2s**: risco de sobrecarregar o ControlID (HTTP request a cada ciclo)
- **Throttle < 1s**: risco de múltiplos uploads simultâneos para a edge function
- **3s de poll + 1.5s de throttle** é o ponto seguro mais baixo

## Arquivos a modificar

1. **`electron/agent.js`** — `pollIntervalMs`: 5000 → 3000
2. **`electron/sync.js`** — `_fastLaneThrottleMs`: 3000 → 1500, delay: 500 → 200
3. **`electron/package.json`** — bump de versão

## O que NÃO muda

- Heurística de timestamp (funciona independente da velocidade)
- Lógica de upload/download
- Edge function

