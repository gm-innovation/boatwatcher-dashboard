import { useState } from 'react';
import { useProjects, useCompanies } from '@/hooks/useSupabase';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Edit2, Trash2, FolderKanban, Building2, MapPin, Calendar } from 'lucide-react';
import type { Project } from '@/types/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/components/theme-provider';
import { format } from 'date-fns';

interface ProjectFormProps {
  project?: Project | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const ProjectForm = ({ project, onSuccess, onCancel }: ProjectFormProps) => {
  const [name, setName] = useState(project?.name || '');
  const [location, setLocation] = useState(project?.location || '');
  const [clientId, setClientId] = useState(project?.client_id || '');
  const [startDate, setStartDate] = useState(project?.start_date || '');
  const [commander, setCommander] = useState(project?.commander || '');
  const [chiefEngineer, setChiefEngineer] = useState(project?.chief_engineer || '');
  const [projectType, setProjectType] = useState(project?.project_type || '');
  const [crewSize, setCrewSize] = useState(project?.crew_size?.toString() || '');
  const [status, setStatus] = useState(project?.status || 'active');
  const [isLoading, setIsLoading] = useState(false);
  
  const { data: companies = [] } = useCompanies();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const projectData = {
        name,
        location: location || null,
        client_id: clientId || null,
        start_date: startDate || null,
        commander: commander || null,
        chief_engineer: chiefEngineer || null,
        project_type: projectType || null,
        crew_size: crewSize ? parseInt(crewSize) : null,
        status
      };

      if (project) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', project.id);
        if (error) throw error;
        toast({ title: 'Projeto atualizado com sucesso' });
      } else {
        const { error } = await supabase
          .from('projects')
          .insert(projectData);
        if (error) throw error;
        toast({ title: 'Projeto cadastrado com sucesso' });
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Projeto *</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Localização</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="clientId">Cliente (Armador)</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent>
              {companies.map(company => (
                <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="startDate">Data de Início</Label>
          <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="commander">Comandante</Label>
          <Input id="commander" value={commander} onChange={(e) => setCommander(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="chiefEngineer">Chefe de Máquinas</Label>
          <Input id="chiefEngineer" value={chiefEngineer} onChange={(e) => setChiefEngineer(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="projectType">Tipo</Label>
          <Input id="projectType" value={projectType} onChange={(e) => setProjectType(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="crewSize">Tripulação</Label>
          <Input id="crewSize" type="number" value={crewSize} onChange={(e) => setCrewSize(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : project ? 'Atualizar' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
};

export const ProjectsManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const { data: projects = [], isLoading } = useProjects();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const handleDelete = async (project: Project) => {
    if (!confirm(`Tem certeza que deseja remover ${project.name}?`)) return;
    
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (error) {
      toast({ title: 'Erro ao remover projeto', variant: 'destructive' });
    } else {
      toast({ title: 'Projeto removido' });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  };

  const getClientLogo = (project: Project) => {
    return theme === 'dark' ? project.client?.logo_url_dark : project.client?.logo_url_light;
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-500/10 text-green-500">Ativo</Badge>;
      case 'inactive': return <Badge className="bg-gray-500/10 text-gray-500">Inativo</Badge>;
      case 'completed': return <Badge className="bg-blue-500/10 text-blue-500">Concluído</Badge>;
      default: return <Badge variant="outline">-</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Projetos</h2>
          <p className="text-sm text-muted-foreground">{projects.length} projetos cadastrados</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingProject(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingProject ? 'Editar Projeto' : 'Novo Projeto'}</DialogTitle>
            </DialogHeader>
            <ProjectForm 
              project={editingProject} 
              onSuccess={() => {
                setIsDialogOpen(false);
                setEditingProject(null);
              }}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingProject(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : projects.length > 0 ? (
        <ScrollArea className="h-[500px] border rounded-lg">
          <table className="w-full">
            <thead className="sticky top-0 bg-card border-b">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Cliente</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Nome</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Local</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Início</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b hover:bg-muted/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {getClientLogo(project) ? (
                          <AvatarImage src={getClientLogo(project)!} alt={project.client?.name} />
                        ) : (
                          <AvatarFallback>
                            <Building2 className="h-5 w-5" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <span className="text-sm text-muted-foreground">{project.client?.name || '-'}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{project.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {project.location || '-'}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {project.start_date ? format(new Date(project.start_date), 'dd/MM/yyyy') : '-'}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {getStatusBadge(project.status)}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingProject(project);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDelete(project)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      ) : (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum projeto cadastrado</p>
          <p className="text-sm">Adicione o primeiro projeto</p>
        </div>
      )}
    </div>
  );
};
