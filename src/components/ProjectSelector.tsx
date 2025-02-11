
import { useProjects } from '@/hooks/useSupabase';
import { useInmetaObras } from '@/hooks/useInmetaApi';
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
  const { data: obras = [], isLoading: isLoadingInmeta } = useInmetaObras();

  const isLoading = isLoadingDb || isLoadingInmeta;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Carregando obras...</span>
      </div>
    );
  }

  // Encontrar a obra selecionada no banco ou no Inmeta
  const selectedObra = obras.find(p => p.id === selectedProjectId);
  const selectedDbProject = dbProjects.find(p => p.id === selectedProjectId);

  // Mesclar projetos do banco com as obras do Inmeta, evitando duplicatas
  const allProjects = [
    ...obras.map(obra => ({
      id: obra.id,
      name: obra.nome,
      source: 'inmeta' as const
    })),
    ...dbProjects
      .filter(p => !obras.some(o => o.id === p.external_project_id))
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
        <SelectValue placeholder="Selecione uma obra">
          {selectedObra?.nome || selectedDbProject?.vessel_name || 'Selecione uma obra'}
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
