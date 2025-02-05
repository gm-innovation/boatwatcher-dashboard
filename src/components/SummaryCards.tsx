
import { Users, Building } from 'lucide-react';

const Card = ({ title, value, icon: Icon, color }: { 
  title: string;
  value: number;
  icon: any;
  color: string;
}) => (
  <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-200 animate-fade-up">
    <div className="flex flex-col items-center justify-center text-center">
      <div className={`p-3 rounded-full ${color} mb-3`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500 mb-1">{title}</p>
        <p className="text-2xl font-semibold text-gray-800">{value}</p>
      </div>
    </div>
  </div>
);

export const SummaryCards = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <Card
        title="Total de Pessoas a Bordo"
        value={42}
        icon={Users}
        color="bg-indigo-500"
      />
      <Card
        title="Total de Empresas"
        value={8}
        icon={Building}
        color="bg-emerald-500"
      />
    </div>
  );
};
