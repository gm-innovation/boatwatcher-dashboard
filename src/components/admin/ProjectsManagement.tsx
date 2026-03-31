import { useState } from 'react';
import { useProjects, useCompanies } from '@/hooks/useSupabase';
import { AdminProjectFilter } from './AdminProjectFilter';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, Edit2, Trash2, FolderKanban, Building2, MapPin, Calendar as CalendarIcon, Check } from 'lucide-react';
import type { Project } from '@/types/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/components/theme-provider';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProjectFormProps {
  project?: Project | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const ProjectForm = ({ project, onSuccess, onCancel }: ProjectFormProps) => {
  const [name, setName] = useState(project?.name || '');
  const [location, setLocation] = useState(project?.location || '');
  const [clientId, setClientId] = useState(project?.client_id || '');
  const [startDate, setStartDate] = useState<Date | undefined>(
    project?.start_date ? new Date(project.start_date) : undefined
  );
  const [commander, setCommander] = useState(project?.commander || '');
  const [chiefEngineer, setChiefEngineer] = useState(project?.chief_engineer || '');
  const [projectType, setProjectType] = useState(project?.project_type || 'docagem');
  const [crewSize, setCrewSize] = useState(project?.crew_size?.toString() || '');
  const [armador, setArmador] = useState(project?.armador || '');
  const [apiProjectId, setApiProjectId] = useState(project?.api_project_id || '');
  const [latitude, setLatitude] = useState(project?.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(project?.longitude?.toString() || '');
  const [isLoading, setIsLoading] = useState(false);
  const [knownLocations, setKnownLocations] = useState<{ name: string; latitude: number; longitude: number }[]>([]);
  
  const { data: companies = [] } = useCompanies();
  const queryClient = useQueryClient();

  // Fetch known locations
  useState(() => {
    supabase.from('known_locations').select('name, latitude, longitude').then(({ data }) => {
      if (data) setKnownLocations(data);
    });
  });

  // Auto-fill coordinates when location matches a known location
  const handleLocationChange = (value: string) => {
    setLocation(value);
    const match = knownLocations.find(kl => kl.name.toLowerCase() === value.toLowerCase());
    if (match) {
      setLatitude(match.latitude.toString());
      setLongitude(match.longitude.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const lat = latitude ? parseFloat(latitude) : null;
      const lng = longitude ? parseFloat(longitude) : null;

      const projectData = {
        name,
        location: location || null,
        client_id: clientId || null,
        start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
        commander: commander || null,
        chief_engineer: chiefEngineer || null,
        project_type: projectType || null,
        crew_size: crewSize ? parseInt(crewSize) : null,
        armador: armador || null,
        api_project_id: apiProjectId || null,
        latitude: lat,
        longitude: lng,
        status: 'active'
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
      // Upsert known_locations if coordinates are provided
      if (location && lat != null && lng != null) {
        await supabase.from('known_locations').upsert(
          { name: location, latitude: lat, longitude: lng },
          { onConflict: 'name' }
        );
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
      {/* Row 1: Nome do Projeto + Cliente */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Projeto *</Label>
          <Input 
            id="name" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Nome do projeto"
            required 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientId">Cliente</Label>
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
      </div>

      {/* Row 2: Armador + Localização */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="armador">Armador</Label>
          <Input 
            id="armador" 
            value={armador} 
            onChange={(e) => setArmador(e.target.value)} 
            placeholder="Nome do armador"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Localização</Label>
          <Input 
            id="location" 
            value={location} 
            onChange={(e) => handleLocationChange(e.target.value)} 
            placeholder="Local do projeto"
          />
        </div>
      </div>

      {/* Row 2.5: Latitude + Longitude */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="latitude">Latitude</Label>
          <Input 
            id="latitude" 
            type="number" 
            step="any"
            value={latitude} 
            onChange={(e) => setLatitude(e.target.value)} 
            placeholder="-23.5505"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="longitude">Longitude</Label>
          <Input 
            id="longitude" 
            type="number" 
            step="any"
            value={longitude} 
            onChange={(e) => setLongitude(e.target.value)} 
            placeholder="-46.6333"
          />
        </div>
      </div>

      {/* Row 3: Tipo de Projeto (Radio) + Data de Início (DatePicker) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Projeto</Label>
          <RadioGroup 
            value={projectType} 
            onValueChange={setProjectType}
            className="flex gap-6 pt-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="docagem" id="docagem" />
              <Label htmlFor="docagem" className="font-normal cursor-pointer">Docagem</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="mobilizacao" id="mobilizacao" />
              <Label htmlFor="mobilizacao" className="font-normal cursor-pointer">Mobilização</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="space-y-2">
          <Label>Data de Início</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione uma data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Row 4: Chefe de Máquinas + Comandante */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="chiefEngineer">Chefe de Máquinas</Label>
          <Input 
            id="chiefEngineer" 
            value={chiefEngineer} 
            onChange={(e) => setChiefEngineer(e.target.value)} 
            placeholder="Nome do chefe de máquinas"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="commander">Comandante</Label>
          <Input 
            id="commander" 
            value={commander} 
            onChange={(e) => setCommander(e.target.value)} 
            placeholder="Nome do comandante"
          />
        </div>
      </div>

      {/* Row 5: Quantidade de Tripulantes + ID do Projeto na API */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="crewSize">Quantidade de Tripulantes</Label>
          <Input 
            id="crewSize" 
            type="number" 
            value={crewSize} 
            onChange={(e) => setCrewSize(e.target.value)} 
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="apiProjectId">ID do Projeto na API</Label>
          <Input 
            id="apiProjectId" 
            value={apiProjectId} 
            onChange={(e) => setApiProjectId(e.target.value)} 
            placeholder="ID do projeto na API externa"
          />
        </div>
      </div>

      {/* Footer: Buttons */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isLoading} className="gap-2">
          <Check className="h-4 w-4" />
          {isLoading ? 'Salvando...' : project ? 'Atualizar Projeto' : 'Criar Projeto'}
        </Button>
      </div>
    </form>
  );
};

export const ProjectsManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const { data: projects = [], isLoading } = useProjects();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const filteredProjects = selectedClientId
    ? projects.filter((p) => p.client_id === selectedClientId)
    : projects;

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
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Projetos</h2>
          <p className="text-sm text-muted-foreground">{filteredProjects.length} projetos</p>
        </div>
        <div className="flex items-center gap-3">
          <AdminProjectFilter
            selectedClientId={selectedClientId}
            onClientChange={setSelectedClientId}
            showProjectFilter={false}
          />
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredProjects.length > 0 ? (
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
              {filteredProjects.map((project) => (
                <tr key={project.id} className="border-b hover:bg-muted/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {getClientLogo(project) ? (
                          <img src={getClientLogo(project)!} alt={project.client?.name} className="h-full w-full object-contain p-1" />
                        ) : (
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
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
                      <CalendarIcon className="h-4 w-4" />
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
