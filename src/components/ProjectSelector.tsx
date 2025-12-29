import { useProjects } from '@/hooks/useSupabase';
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
  const { data: projects = [], isLoading } = useProjects();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Carregando...</span>
      </div>
    );
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <Select 
      value={selectedProjectId || undefined} 
      onValueChange={onProjectSelect}
    >
      <SelectTrigger className="w-[300px]">
        <SelectValue placeholder="Selecione um projeto">
          {selectedProject?.name || 'Selecione um projeto'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
