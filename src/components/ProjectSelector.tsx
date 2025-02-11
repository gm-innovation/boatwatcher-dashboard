
import { useProjects } from '@/hooks/useSupabase';
import { useInmetaProjects } from '@/hooks/useInmetaApi';
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
  const { data: inmetaProjects = [], isLoading: isLoadingInmeta } = useInmetaProjects();

  const isLoading = isLoadingDb || isLoadingInmeta;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Carregando obras...</span>
      </div>
    );
  }

  // Encontrar o projeto selecionado no banco ou no Inmeta
  const selectedInmetaProject = inmetaProjects.find(p => p.id === selectedProjectId);
  const selectedDbProject = dbProjects.find(p => p.id === selectedProjectId);

  // Mesclar projetos do banco com os do Inmeta, evitando duplicatas
  const allProjects = [
    ...inmetaProjects.map(p => ({
      id: p.id,
      name: p.nome,
      source: 'inmeta' as const
    })),
    ...dbProjects
      .filter(p => !inmetaProjects.some(ip => ip.id === p.external_project_id))
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
          {selectedInmetaProject?.nome || selectedDbProject?.vessel_name || 'Selecione uma obra'}
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
