import { Users, Building, Anchor } from 'lucide-react';
import { useProjectById } from '@/hooks/useSupabase';

const Card = ({ title, value, icon: Icon, color, highlight = false }: { 
  title: string;
  value: number;
  icon: any;
  color: string;
  highlight?: boolean;
}) => (
  <div className={`${
    highlight 
      ? 'bg-purple-100/80 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700' 
      : 'bg-background/80 border-border'
    } backdrop-blur-sm rounded-lg border p-6 hover:shadow-lg transition-shadow duration-200 animate-fade-up`}>
    <div className="flex flex-col items-center justify-center text-center">
      <div className={`p-3 rounded-full ${color} mb-3`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <p className={`text-2xl font-semibold ${
          highlight 
            ? 'text-purple-800 dark:text-purple-300' 
            : 'text-foreground'
          }`}>{value}</p>
      </div>
    </div>
  </div>
);

interface SummaryCardsProps {
  projectId: string | null;
}

export const SummaryCards = ({ projectId }: SummaryCardsProps) => {
  const { data: projectInfo } = useProjectById(projectId);

  // Use project data if available, otherwise fallback to default values
  const crewCount = projectInfo?.crew_count || 0;
  const workersCount = 42; // This seems to be a mock value, keep it for now
  const totalCount = crewCount + workersCount;
  const companiesCount = 8; // This seems to be a mock value, keep it for now

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <Card
        title="Tripulação a Bordo"
        value={crewCount}
        icon={Anchor}
        color="bg-blue-500"
      />
      <Card
        title="Total de Pessoas a Bordo"
        value={totalCount}
        icon={Users}
        color="bg-purple-500"
        highlight={true}
      />
      <Card
        title="Total de Empresas"
        value={companiesCount}
        icon={Building}
        color="bg-emerald-500"
      />
    </div>
  );
};