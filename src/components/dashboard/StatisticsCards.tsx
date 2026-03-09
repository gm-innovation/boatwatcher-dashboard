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
  bgColor: string;
  iconBgColor: string;
  textColor: string;
}

const StatCard = ({ icon, label, value, bgColor, iconBgColor, textColor }: StatCardProps) =>
<div className={`${bgColor} rounded-lg border p-6 flex items-center gap-4`}>
    <div className={`p-3 rounded-full ${iconBgColor}`}>
      {icon}
    </div>
    <div>
      <p className={`text-sm ${textColor} opacity-80`}>{label}</p>
      <p className={`text-4xl font-bold ${textColor}`}>{value}</p>
    </div>
  </div>;


export const StatisticsCards = ({ crewSize, workersOnBoard, companiesOnBoard }: StatisticsCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        icon={<Ship className="h-6 w-6 text-blue-600" />}
        label="Tripulação a Bordo"
        value={crewSize}
        bgColor="bg-blue-50 dark:bg-blue-950/30"
        iconBgColor="bg-blue-100 dark:bg-blue-900/50"
        textColor="text-blue-900 dark:text-blue-100" />
      
      <StatCard
        icon={<Users className="h-6 w-6 text-green-600" />}
        label="A Bordo"
        value={workersOnBoard}
        bgColor="bg-green-50 dark:bg-green-950/30"
        iconBgColor="bg-green-100 dark:bg-green-900/50"
        textColor="text-green-900 dark:text-green-100" />
      
      <StatCard
        icon={<Building className="h-6 w-6 text-purple-600" />}
        label="Empresas a Bordo"
        value={companiesOnBoard}
        bgColor="bg-purple-50 dark:bg-purple-950/30"
        iconBgColor="bg-purple-100 dark:bg-purple-900/50"
        textColor="text-purple-900 dark:text-purple-100" />
      
    </div>);

};