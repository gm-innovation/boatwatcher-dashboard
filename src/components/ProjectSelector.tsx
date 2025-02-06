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

  // Filter out projects without a vessel name
  const validProjects = projects.filter(project => project.vessel_name);

  return (
    <Select value={selectedProjectId || undefined} onValueChange={onProjectSelect}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Selecione um projeto">
          {selectedProjectId && validProjects.find(p => p.id === selectedProjectId)?.vessel_name}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {validProjects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.vessel_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};