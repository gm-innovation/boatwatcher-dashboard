
import { Ship, Calendar, User, Building2, Anchor } from 'lucide-react';
import { useProject } from '@/hooks/useSupabase';

export const ProjectInfo = () => {
  const { data: projectInfo, isLoading } = useProject();

  if (isLoading) {
    return (
      <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-border p-4 mb-6 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-3"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
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

  if (!projectInfo) return null;

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-border p-4 mb-6 animate-fade-up">
      <h2 className="text-lg font-semibold mb-3 text-foreground">Informações do Projeto</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="flex items-center space-x-2">
          <Ship className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Embarcação</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.vessel_name}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Data de Início</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.start_date}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Anchor className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Tipo de Projeto</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.project_type}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Responsável</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.engineer}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Armador</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.company}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Comandante</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.captain}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
