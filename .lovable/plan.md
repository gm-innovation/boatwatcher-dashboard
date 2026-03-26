

# Evolução do Sistema de Relatórios

## Situação Atual
- A página de relatórios faz queries ao vivo (access_logs, workers, worker_documents) sem salvar snapshots
- A tabela `generated_reports` existe mas não é utilizada
- A edge function `scheduled-reports` gera dados mas não salva na `generated_reports`
- O `ReportScheduler` existe como componente mas não está na página de relatórios
- Não há cron job configurado para execução automática
- Não há envio de e-mail aos destinatários

## Plano de Implementação

### 1. Atualizar a Edge Function `scheduled-reports`
- Salvar o resultado de cada relatório na tabela `generated_reports` com `report_type`, `project_id`, `filters` (incluindo date_range) e `data` (JSON com o snapshot)
- Adicionar campos `date_range_start` e `date_range_end` à tabela `generated_reports` via migração
- Enriquecer os relatórios: cruzar access_logs com workers/companies para incluir nomes, empresas, horas trabalhadas no snapshot JSON
- Filtrar por `project_id` quando disponível (via devices do projeto)

### 2. Adicionar Geração Manual de Relatórios
- Na página Reports, adicionar botão "Gerar Relatório" que chama a edge function `scheduled-reports` com `{ schedule_id, manual: true }` ou parâmetros diretos (`report_type`, `project_id`, `date_range`)
- Mostrar loading e toast de sucesso/erro

### 3. Criar aba "Relatórios Gerados" na página Reports
- Nova aba listando registros da tabela `generated_reports` ordenados por `created_at` desc
- Cada item mostra: tipo, período, data de geração, quantidade de registros
- Ao clicar, abre dialog/drawer renderizando o campo `data` em tabela formatada
- Botões de exportar PDF/CSV a partir do snapshot salvo

### 4. Integrar o ReportScheduler na página Reports
- Adicionar aba "Agendamentos" usando o componente `ReportScheduler` já existente
- Adicionar botão "Executar Agora" em cada agendamento que chama a edge function manualmente

### 5. Configurar Cron Job (pg_cron)
- Habilitar extensões `pg_cron` e `pg_net`
- Criar job que chama `scheduled-reports` a cada hora para verificar agendamentos pendentes

### 6. Migração SQL
- Adicionar colunas `date_range_start` e `date_range_end` (timestamptz) à `generated_reports`
- Adicionar policy de UPDATE para admins em `generated_reports`

### Arquivos Alterados/Criados
- `supabase/functions/scheduled-reports/index.ts` — salvar em generated_reports, enriquecer dados
- `src/pages/Reports.tsx` — adicionar abas "Gerados" e "Agendamentos"
- `src/components/reports/GeneratedReportsList.tsx` — novo componente para listar/visualizar relatórios salvos
- `src/components/reports/ReportScheduler.tsx` — adicionar botão "Executar Agora"
- Migração SQL — colunas e policies

