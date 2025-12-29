import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FolderKanban, 
  MapPin,
  Calendar,
  Users,
  Ship
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const MyProjects = () => {
  const { user } = useAuth();

  // Get company ID for current user
  const { data: userCompany } = useQuery({
    queryKey: ['user-company', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_companies')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data?.company_id;
    },
    enabled: !!user?.id
  });

  // Get workers for company to find which projects they're allowed in
  const { data: companyWorkers = [] } = useQuery({
    queryKey: ['company-workers-projects', userCompany],
    queryFn: async () => {
      if (!userCompany) return [];
      
      const { data, error } = await supabase
        .from('workers')
        .select('id, allowed_project_ids')
        .eq('company_id', userCompany);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userCompany
  });

  // Get unique project IDs from workers
  const projectIds = [...new Set(
    companyWorkers
      .flatMap(w => w.allowed_project_ids || [])
      .filter(Boolean)
  )];

  // Get projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['company-projects', projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:companies(name, logo_url_light)
        `)
        .in('id', projectIds)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: projectIds.length > 0
  });

  // Count workers per project
  const getWorkersInProject = (projectId: string) => {
    return companyWorkers.filter(w => 
      w.allowed_project_ids?.includes(projectId)
    ).length;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5" />
          Meus Projetos ({projects.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum projeto associado</p>
            <p className="text-sm mt-1">Seus trabalhadores ainda não estão alocados em projetos</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="grid gap-4">
              {projects.map((project) => (
                <Card key={project.id} className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Ship className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-lg">{project.name}</h3>
                          <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                            {project.status === 'active' ? 'Ativo' : project.status}
                          </Badge>
                        </div>
                        
                        {project.client && (
                          <p className="text-sm text-muted-foreground">
                            Cliente: {project.client.name}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {project.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {project.location}
                            </div>
                          )}
                          {project.start_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(project.start_date), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {getWorkersInProject(project.id)} trabalhadores
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
