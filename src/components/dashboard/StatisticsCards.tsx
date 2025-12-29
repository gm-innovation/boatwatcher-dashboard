import { Ship, Users, Building } from 'lucide-react';

interface StatisticsCardsProps {
  crewSize: number;
  workersOnBoard: number;
  companiesOnBoard: number;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

const StatCard = ({ icon, label, value }: StatCardProps) => (
  <div className="bg-card rounded-lg border p-6 flex items-center gap-4">
    <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
      {icon}
    </div>
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  </div>
);

export const StatisticsCards = ({ crewSize, workersOnBoard, companiesOnBoard }: StatisticsCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        icon={<Ship className="h-6 w-6 text-blue-600" />}
        label="Tripulação a Bordo"
        value={crewSize}
      />
      <StatCard
        icon={<Users className="h-6 w-6 text-blue-600" />}
        label="A Bordo"
        value={workersOnBoard}
      />
      <StatCard
        icon={<Building className="h-6 w-6 text-blue-600" />}
        label="Empresas a Bordo"
        value={companiesOnBoard}
      />
    </div>
  );
};