import { useProjects } from '@/hooks/useSupabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
}

export const ProjectSelector = ({ selectedProjectId, onProjectSelect }: ProjectSelectorProps) => {
  const { data: projects = [], isLoading } = useProjects();

  if (isLoading) {
    return (
      <div className="h-10 w-[200px] bg-muted animate-pulse rounded-md"></div>
    );
  }

  return (
    <Select 
      value={selectedProjectId || undefined} 
      onValueChange={onProjectSelect}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Selecione um projeto" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.vessel_name || 'Projeto sem nome'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};