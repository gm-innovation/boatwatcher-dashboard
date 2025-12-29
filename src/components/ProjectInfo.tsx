import { Ship, Calendar, Building2 } from 'lucide-react';
import { useProjectById } from '@/hooks/useSupabase';

interface ProjectInfoProps {
  projectId: string | null;
}

export const ProjectInfo = ({ projectId }: ProjectInfoProps) => {
  const { data: projectInfo, isLoading } = useProjectById(projectId);

  if (isLoading) {
    return (
      <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-border p-4 mb-6 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-3"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-2">
              <div className="h-4 w-4 bg-muted rounded"></div>
              <div>
                <div className="h-3 w-20 bg-muted rounded mb-1"></div>
                <div className="h-4 w-24 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!projectInfo) {
    return (
      <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-border p-4 mb-6">
        <p className="text-center text-muted-foreground">
          Selecione um projeto para ver suas informações
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-border p-4 mb-6 animate-fade-up">
      <h2 className="text-lg font-semibold mb-3 text-foreground">Informações do Projeto</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="flex items-center space-x-2">
          <Ship className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Projeto</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.name || 'Não informado'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.client?.name || 'Não informado'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.status || 'Ativo'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
