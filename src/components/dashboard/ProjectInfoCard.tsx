import { Building, Calendar, User, Wrench, Ship, Users, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import type { Project } from '@/types/supabase';
import { useTheme } from '@/components/theme-provider';

interface ProjectInfoCardProps {
  project: Project | null;
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}

const InfoItem = ({ icon, label, value }: InfoItemProps) => (
  <div className="flex items-center gap-2 min-w-0">
    <div className="flex-shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium truncate">{value || '.'}</p>
    </div>
  </div>
);

export const ProjectInfoCard = ({ project }: ProjectInfoCardProps) => {
  const { theme } = useTheme();
  
  if (!project) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <p className="text-muted-foreground text-center">Selecione um projeto</p>
      </div>
    );
  }

  const clientLogo = theme === 'dark' 
    ? project.client?.logo_url_dark 
    : project.client?.logo_url_light;

  const formattedStartDate = project.start_date 
    ? format(new Date(project.start_date), "dd/MM/yyyy")
    : null;

  return (
    <div className="bg-card rounded-lg border">
      {/* Top section: Logo + Project name */}
      <div className="flex items-center gap-4 p-5 pb-4">
        <div className="flex-shrink-0">
          {clientLogo ? (
            <img 
              src={clientLogo} 
              alt={project.client?.name || 'Logo'} 
              className="h-16 w-20 object-contain rounded-lg bg-muted p-2"
            />
          ) : (
            <div className="h-16 w-20 bg-muted rounded-lg flex items-center justify-center">
              <Building className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold">{project.name}</h2>
          {project.location && (
            <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-sm">{project.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Bottom section: Info items in a single row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 p-5 pt-4">
        <InfoItem
          icon={<Building className="h-5 w-5 text-blue-600" />}
          label="Armador"
          value={project.client?.name || null}
        />
        <InfoItem
          icon={<Calendar className="h-5 w-5 text-green-600" />}
          label="Início"
          value={formattedStartDate}
        />
        <InfoItem
          icon={<User className="h-5 w-5 text-purple-600" />}
          label="Comandante"
          value={project.commander}
        />
        <InfoItem
          icon={<Wrench className="h-5 w-5 text-orange-600" />}
          label="Chefe de Máquinas"
          value={project.chief_engineer}
        />
        <InfoItem
          icon={<Ship className="h-5 w-5 text-cyan-600" />}
          label="Tipo"
          value={project.project_type}
        />
        <InfoItem
          icon={<Users className="h-5 w-5 text-indigo-600" />}
          label="Tripulação"
          value={project.crew_size?.toString() || null}
        />
      </div>
    </div>
  );
};
