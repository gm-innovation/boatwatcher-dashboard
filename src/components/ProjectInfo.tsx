import { Ship, Calendar, User, Building2, Anchor } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import type { Project } from '@/types/supabase';

interface ProjectInfoProps {
  projectId: string | null;
}

interface ProjectDetails extends Project {
  client_name: string;
  logo_url_light: string;
  logo_url_dark: string;
}

export const ProjectInfo = ({ projectId }: ProjectInfoProps) => {
  console.log("ProjectInfo - Received projectId:", projectId);

  const { data: projectInfo, isLoading, error } = useQuery<ProjectDetails | null>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      
      console.log("ProjectInfo - Fetching data for projectId:", projectId);
      
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          companies!projects_client_id_fkey (
            name,
            logo_url_light,
            logo_url_dark
          )
        `)
        .eq('id', projectId)
        .single();
      
      if (error) {
        console.error('ProjectInfo - Error fetching project:', error);
        throw error;
      }

      console.log("ProjectInfo - Fetched data:", data);
      return {
        ...data,
        client_name: data.companies?.name || 'Não definido',
        logo_url_light: data.companies?.logo_url_light || '',
        logo_url_dark: data.companies?.logo_url_dark || ''
      } as ProjectDetails;
    },
    enabled: !!projectId
  });

  console.log("ProjectInfo - Query result:", { isLoading, error, projectInfo });

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="flex items-center space-x-2">
          <Ship className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Embarcação</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.vessel_name || 'Não informado'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Data de Início</p>
            <p className="text-sm font-medium text-foreground">
              {projectInfo.start_date ? format(new Date(projectInfo.start_date), 'dd/MM/yyyy') : 'Não informado'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Anchor className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Tipo de Projeto</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.project_type || 'Não informado'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Responsável</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.engineer || 'Não informado'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Armador</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.client_name}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Comandante</p>
            <p className="text-sm font-medium text-foreground">{projectInfo.captain || 'Não informado'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};