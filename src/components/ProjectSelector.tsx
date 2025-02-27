import { useProjects } from '@/hooks/useSupabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Mapeamento de IDs para nomes de locais
const PROJECT_NAMES: Record<string, string> = {
  'cb9babbc-c77f-40db-a0b7-f3187b4659fb': 'BEN MOINHOS SMART LIFE',
  '38277272-7079-4492-830a-a78a9f006c67': 'BALN. RINCAO TERRENO MICHELS',
  '7c52d6d7-aa0e-4f6c-b02d-4d91728f5753': 'NOVA ALAMEDA',
  '9e8d7c6b-5a4f-3e2d-1c9b-8a7f6d5e4c3a': 'SANTA MARIA',
  'b2a1c9d8-7e6f-5d4c-3b2a-1f9e8d7c6b5a': 'TORRES DE PRATA',
  'd4c3b2a1-9e8f-7d6c-5b4a-3f2e1d9c8b7a': 'LISSANDRA',
  'f8d7a8e9-b3c1-4b5d-9e6f-2d8b1f3c4a5b': 'BEN MOINHOS SMART LIFE'
};

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

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const projectName = selectedProjectId ? PROJECT_NAMES[selectedProjectId] : undefined;

  return (
    <Select 
      value={selectedProjectId || undefined} 
      onValueChange={onProjectSelect}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Selecione um projeto">
          {projectName || selectedProject?.vessel_name || 'Projeto sem nome'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {PROJECT_NAMES[project.id] || project.vessel_name || 'Projeto sem nome'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};