

## Problema

O `package.json` declara `"version": "1.2.2"`, mas a tag Git é `v1.2.4`. O `electron-builder --publish always` publica os artefatos no GitHub Release correspondente à versão do `package.json` (v1.2.2), não à tag atual (v1.2.4). Por isso o release v1.2.4 fica apenas com source code.

## Correção

### 1. Atualizar a versão no `package.json`

Alterar `"version": "1.2.2"` para `"version": "1.2.5"` (próxima versão, já que v1.2.3 e v1.2.4 foram releases quebrados).

### 2. Após o commit

1. Deletar os releases v1.2.3 e v1.2.4 no GitHub (e suas tags, se desejar)
2. Criar nova tag `v1.2.5` e fazer push
3. O workflow vai buildar e publicar os artefatos no release v1.2.5 corretamente

### Dica para o futuro

Sempre bumpar a versão no `package.json` antes de criar uma nova tag. Idealmente, adicionar um step no workflow que valide `package.json version == tag version`.

## Mudança técnica

**Arquivo:** `package.json` linha 5
```
"version": "1.2.2"  →  "version": "1.2.5"
```

