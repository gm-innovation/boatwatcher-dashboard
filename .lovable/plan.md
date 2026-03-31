

## App Android Standalone — Controle de Acesso

### Objetivo
Empacotar o módulo de Controle de Acesso como um APK Android instalável via Capacitor, com acesso exclusivo às telas de controle de acesso (login dedicado, registro, configuração) — sem sidebar nem acesso ao sistema principal.

### Arquitetura

```text
App Android (Capacitor)
  └─ /access-control/login   → Login dedicado do operador
  └─ /access-control/        → Tela principal (QR, busca, registro)
  └─ /access-control/config  → Configuração dos pontos

Detecção: Capacitor.isNativePlatform() → true = modo standalone
```

### Implementação

#### 1. Instalar Capacitor
- Dependências: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
- Inicializar com `npx cap init` e configurar `capacitor.config.ts`
- `appId`: `app.lovable.3e981c04bfa74702822c2908ab036748`
- `appName`: `Dock Check Acesso`
- `server.url` apontando para o preview sandbox (hot-reload)

#### 2. Login dedicado (`src/pages/access-control/AccessControlLogin.tsx`)
- Tela de login minimalista, mobile-first
- Título "Controle de Acesso" com branding
- Apenas email + senha, sem link para o sistema
- Valida role (admin/operator), redireciona para `/access-control/`

#### 3. Shell standalone (`src/components/access-control/AccessControlShell.tsx`)
- Layout fullscreen sem sidebar
- Header compacto: status online/offline, logout
- Sem navegação para o sistema principal

#### 4. Roteamento condicional (`App.tsx`)
- Detectar se está rodando como app nativo (`Capacitor.isNativePlatform()`)
- **Modo nativo**: renderiza APENAS rotas `/access-control/*` — rota raiz `/` redireciona para `/access-control/login`
- **Modo web**: mantém tudo como está, com link no sidebar abrindo em nova aba

#### 5. Refatorar `AccessControl.tsx`
- Remover botão "voltar para /" (não faz sentido no standalone)
- Usar `AccessControlShell` como wrapper
- Config acessível via rota `/access-control/config` em vez de estado

#### 6. Sidebar do sistema principal
- Link "Acesso Manual" abre `/access-control/` em nova aba (`target="_blank"`)

### Arquivos

| Arquivo | Ação |
|---|---|
| `capacitor.config.ts` | Criar — config do Capacitor |
| `src/pages/access-control/AccessControlLogin.tsx` | Criar — login dedicado |
| `src/components/access-control/AccessControlShell.tsx` | Criar — shell standalone |
| `src/pages/AccessControl.tsx` | Refatorar — modo standalone |
| `src/App.tsx` | Atualizar — roteamento condicional |
| `src/components/layouts/AppSidebar.tsx` | Atualizar — link nova aba |

### Para instalar no Android
Após a implementação, você precisará:
1. Exportar o projeto para o GitHub
2. Clonar, rodar `npm install`
3. `npx cap add android`
4. `npx cap sync`
5. `npx cap run android` (requer Android Studio)

O APK gerado pode ser distribuído diretamente para os tablets/celulares dos operadores.

