

## Implementar geração de etiquetas PDF no formato do sistema em produção

### Contexto
A imagem fornecida mostra uma etiqueta vertical (62×100mm) com texto rotacionado -90°, contendo: nome do trabalhador (bold), função, empresa, nome do projeto, tipo do projeto, logo rotacionada do cliente, código dentro de um círculo, tipo sanguíneo e "Powered by Googlemarine".

O código de referência (Deno edge function) já implementa essa lógica. Preciso replicá-la no front-end usando jsPDF (já instalado no projeto, usado em `BadgePrinter.tsx`).

### Implementação

**Arquivo: `src/components/workers/WorkerManagement.tsx`**

1. Criar função `handlePrintLabels` que:
   - Busca o projeto selecionado e seu `client_id`
   - Busca o cliente (company com type=client) para obter `logo_url_rotated`
   - Busca job functions para mapear `job_function_id` → nome
   - Busca companies para mapear `company_id` → nome
   - Gera PDF com jsPDF no formato 62×100mm (portrait)

2. Para cada trabalhador selecionado, gerar uma página com:
   - Borda retangular (rect 3,3 até pageWidth-6, pageHeight-6)
   - Logo rotacionada do cliente (canto superior direito, 8×24mm)
   - Nome (formatado: primeiro + último nome, ou customName se 1 trabalhador) — rotacionado -90°, font 16 bold
   - Função (job_function) — rotacionado -90°, font 12
   - Empresa — rotacionado -90°, font 10
   - Nome do projeto — rotacionado -90°, font dinâmico (9-14 conforme comprimento)
   - Tipo do projeto (Docagem/Mobilização/Projeto) — rotacionado -90°, font 12
   - Círculo com código (4 dígitos, padStart '0') — centro em (40,80), raio 16
   - "Powered by Googlemarine" — font 6, cor cinza
   - Tipo sanguíneo (se válido) — label + valor

3. Atualizar o `onClick` do botão "Imprimir Etiquetas" para chamar `handlePrintLabels`

### Dados necessários (já disponíveis no componente)
- `workers` — lista completa com `blood_type`, `job_function_id`, `company_id`, `code`, `name`
- `companies` — para mapear company_id → name
- `projects` — para obter projeto, client_id, project_type
- Job functions: adicionar `useJobFunctions()` do hook existente

### Dependências
- `jsPDF` — já instalado (usado em BadgePrinter)
- `resolveFileUrl` — para resolver a URL da logo rotacionada do cliente
- Remoção de acentos com `normalize('NFD')`

### Arquivos alterados
- `src/components/workers/WorkerManagement.tsx` — adicionar import de useJobFunctions, adicionar função de geração PDF, conectar ao botão

