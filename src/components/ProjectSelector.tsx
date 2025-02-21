
import { useProjects } from '@/hooks/useSupabase';
import { useInmetaEvents } from '@/hooks/useInmetaApi';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react";

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
}

export const ProjectSelector = ({ selectedProjectId, onProjectSelect }: ProjectSelectorProps) => {
  const { data: dbProjects = [], isLoading: isLoadingDb } = useProjects();
  const { data: events = [], isLoading: isLoadingInmeta } = useInmetaEvents(selectedProjectId);
  const isLoading = isLoadingDb || isLoadingInmeta;

  console.log('ProjectSelector - Debug Info:', {
    selectedProjectId,
    dbProjects,
    events,
    isLoadingDb,
    isLoadingInmeta
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Carregando...</span>
      </div>
    );
  }
  // Extrair alvo único dos eventos
  const alvosMap = new Map<string, { id: string; nome: string }>();
  events.forEach(event => {
    if (event.alvo?.id && event.alvo?.nome) {
      alvosMap.set(event.alvo.id, event.alvo);
    }
  });
  
  // Encontrar o alvo selecionado
  const selectedAlvo = Array.from(alvosMap.values()).find(a => a.id === selectedProjectId);
  const selectedDbProject = dbProjects.find(p => p.id === selectedProjectId);

  // Mesclar projetos do banco com os alvos dos eventos
  const allProjects = [
    ...Array.from(alvosMap.values()).map(alvo => ({
      id: alvo.id,
      name: alvo.nome,
      source: 'inmeta' as const
    })),
    ...dbProjects
      .filter(p => !alvosMap.has(p.external_project_id || ''))
      .map(p => ({
        id: p.id,
        name: p.vessel_name || 'Sem nome',
        source: 'db' as const
      }))
  ];

  return (
    <Select 
      value={selectedProjectId || undefined} 
      onValueChange={onProjectSelect}
    >
      <SelectTrigger className="w-[300px]">
        <SelectValue placeholder="Selecione um projeto">
          {selectedAlvo?.nome || selectedDbProject?.vessel_name || 'Selecione um projeto'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allProjects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
