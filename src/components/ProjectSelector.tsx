
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
        <span>Carregando projetos...</span>
      </div>
    );
  }

  // Encontrar o projeto selecionado em ambas as fontes
  const selectedProject = dbProjects.find(p => p.id === selectedProjectId);
  const selectedInmetaProject = inmetaProjects.find(p => p.id === selectedProject?.external_project_id);

  return (
    <Select 
      value={selectedProjectId || undefined} 
      onValueChange={onProjectSelect}
    >
      <SelectTrigger className="w-[300px]">
        <SelectValue placeholder="Selecione um projeto">
          {selectedProject?.vessel_name || selectedInmetaProject?.nome || 'Selecione um projeto'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {dbProjects.map((project) => {
          // Encontrar o projeto correspondente no Inmeta
          const inmetaProject = inmetaProjects.find(p => p.id === project.external_project_id);
          return (
            <SelectItem key={project.id} value={project.id}>
              {project.vessel_name || inmetaProject?.nome || 'Projeto sem nome'}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};
