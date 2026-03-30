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
  iconBgColor: string;
}

const StatCard = ({ icon, label, value, iconBgColor }: StatCardProps) => (
  <div className="bg-card rounded-xl shadow-sm p-4 flex flex-col gap-2">
    <div className={`p-2 rounded-full ${iconBgColor} w-fit`}>
      {icon}
    </div>
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="text-2xl font-bold text-foreground">{value}</p>
  </div>
);

export const StatisticsCards = ({ crewSize, workersOnBoard, companiesOnBoard }: StatisticsCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        icon={<Ship className="h-6 w-6 text-blue-600" />}
        label="Tripulação a Bordo"
        value={crewSize}
        iconBgColor="bg-blue-100 dark:bg-blue-900/50"
      />
      <StatCard
        icon={<Users className="h-6 w-6 text-green-600" />}
        label="A Bordo"
        value={workersOnBoard}
        iconBgColor="bg-green-100 dark:bg-green-900/50"
      />
      <StatCard
        icon={<Building className="h-6 w-6 text-purple-600" />}
        label="Empresas a Bordo"
        value={companiesOnBoard}
        iconBgColor="bg-purple-100 dark:bg-purple-900/50"
      />
    </div>
  );
};