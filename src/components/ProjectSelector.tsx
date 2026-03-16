import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
}

export const ProjectSelector = ({ selectedProjectId, onProjectSelect }: ProjectSelectorProps) => {
  const { projects, loading } = useProject();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Carregando...</span>
      </div>
    );
  }

  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  return (
    <Select value={selectedProjectId || undefined} onValueChange={onProjectSelect}>
      <SelectTrigger className="w-[300px]">
        <SelectValue placeholder="Selecione um projeto">
          {selectedProject ? `${selectedProject.client?.name || 'Cliente'} — ${selectedProject.name}` : 'Selecione um projeto'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.client?.name ? `${project.client.name} — ${project.name}` : project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
