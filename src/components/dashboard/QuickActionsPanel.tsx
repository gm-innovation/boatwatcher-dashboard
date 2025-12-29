import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, Server, FileText, RefreshCw } from 'lucide-react';

interface QuickActionsPanelProps {
  onRefresh?: () => void;
}

export const QuickActionsPanel = ({ onRefresh }: QuickActionsPanelProps) => {
  const navigate = useNavigate();

  const actions = [
    {
      icon: UserPlus,
      label: 'Novo Trabalhador',
      onClick: () => navigate('/people/workers'),
      color: 'text-blue-500',
    },
    {
      icon: Server,
      label: 'Novo Dispositivo',
      onClick: () => navigate('/admin/devices'),
      color: 'text-green-500',
    },
    {
      icon: FileText,
      label: 'Gerar Relatório',
      onClick: () => navigate('/reports'),
      color: 'text-purple-500',
    },
    {
      icon: RefreshCw,
      label: 'Atualizar Dados',
      onClick: onRefresh,
      color: 'text-orange-500',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Ações Rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={action.onClick}
            >
              <action.icon className={`h-5 w-5 ${action.color}`} />
              <span className="text-xs">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
