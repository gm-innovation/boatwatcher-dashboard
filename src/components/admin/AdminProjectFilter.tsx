import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClients, useProjects } from '@/hooks/useSupabase';
import { Loader2 } from 'lucide-react';

interface AdminProjectFilterProps {
  selectedClientId: string | null;
  selectedProjectId?: string | null;
  onClientChange: (clientId: string | null) => void;
  onProjectChange?: (projectId: string | null) => void;
  showProjectFilter?: boolean;
}

export const AdminProjectFilter = ({
  selectedClientId,
  selectedProjectId,
  onClientChange,
  onProjectChange,
  showProjectFilter = true,
}: AdminProjectFilterProps) => {
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: projects = [], isLoading: loadingProjects } = useProjects();

  const filteredProjects = useMemo(() => {
    if (!selectedClientId) return projects;
    return projects.filter((p) => p.client_id === selectedClientId);
  }, [projects, selectedClientId]);

  if (loadingClients || loadingProjects) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Carregando filtros...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select
        value={selectedClientId || '__all__'}
        onValueChange={(v) => {
          const value = v === '__all__' ? null : v;
          onClientChange(value);
          // Reset project when client changes
          if (onProjectChange) onProjectChange(null);
        }}
      >
        <SelectTrigger className="w-[220px] h-9 text-sm">
          <SelectValue placeholder="Todos os clientes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos os clientes</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showProjectFilter && onProjectChange && (
        <Select
          value={selectedProjectId || '__all__'}
          onValueChange={(v) => onProjectChange(v === '__all__' ? null : v)}
        >
          <SelectTrigger className="w-[220px] h-9 text-sm">
            <SelectValue placeholder="Todos os projetos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os projetos</SelectItem>
            {filteredProjects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};
