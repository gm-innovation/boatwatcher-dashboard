import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccessPointConfig } from '@/components/access-control/AccessPointConfig';
import { AccessControlShell } from '@/components/access-control/AccessControlShell';

export default function AccessControlConfig() {
  const navigate = useNavigate();

  return (
    <AccessControlShell>
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/access-control')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold">Configurar Pontos de Controle</h2>
        </div>
        <AccessPointConfig />
      </div>
    </AccessControlShell>
  );
}
