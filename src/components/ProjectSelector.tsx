
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
  const { data: inmetaProjects = [], isLoading: isLoadingInmeta } = useInmetaProjects();

  if (isLoadingInmeta) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Carregando obras...</span>
      </div>
    );
  }

  // Encontrar o projeto selecionado no Inmeta
  const selectedInmetaProject = inmetaProjects.find(p => p.id === selectedProjectId);

  return (
    <Select 
      value={selectedProjectId || undefined} 
      onValueChange={onProjectSelect}
    >
      <SelectTrigger className="w-[300px]">
        <SelectValue placeholder="Selecione uma obra">
          {selectedInmetaProject?.nome || 'Selecione uma obra'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {inmetaProjects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.nome || 'Obra sem nome'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
