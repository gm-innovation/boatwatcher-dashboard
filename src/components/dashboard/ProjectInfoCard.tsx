import { Building, Calendar, User, Wrench, Ship, Users, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Project } from '@/types/supabase';
import { useTheme } from '@/components/theme-provider';

interface ProjectInfoCardProps {
  project: Project | null;
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  iconBgColor: string;
}

const InfoItem = ({ icon, label, value, iconBgColor }: InfoItemProps) => (
  <div className="flex items-center gap-3">
    <div className={`p-2 rounded-full ${iconBgColor}`}>
      {icon}
    </div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '-'}</p>
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
    ? format(new Date(project.start_date), "dd 'de' MMMM, yyyy", { locale: ptBR })
    : null;

  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Logo */}
        <div className="flex-shrink-0">
          {clientLogo ? (
            <img 
              src={clientLogo} 
              alt={project.client?.name || 'Logo'} 
              className="h-24 w-32 object-contain rounded-lg bg-muted p-2"
            />
          ) : (
            <div className="h-24 w-32 bg-muted rounded-lg flex items-center justify-center">
              <Building className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Project Info */}
        <div className="flex-1">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">{project.name}</h2>
            {project.location && (
              <div className="flex items-center gap-1 text-muted-foreground mt-1">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{project.location}</span>
              </div>
            )}
          </div>

          {/* Info Grid - single row */}
          <div className="flex flex-wrap gap-6">
            <InfoItem
              icon={<Building className="h-4 w-4 text-blue-600" />}
              iconBgColor="bg-blue-100 dark:bg-blue-900/30"
              label="Armador"
              value={project.client?.name || null}
            />
            <InfoItem
              icon={<Calendar className="h-4 w-4 text-green-600" />}
              iconBgColor="bg-green-100 dark:bg-green-900/30"
              label="Início"
              value={formattedStartDate}
            />
            <InfoItem
              icon={<User className="h-4 w-4 text-purple-600" />}
              iconBgColor="bg-purple-100 dark:bg-purple-900/30"
              label="Comandante"
              value={project.commander}
            />
            <InfoItem
              icon={<Wrench className="h-4 w-4 text-orange-600" />}
              iconBgColor="bg-orange-100 dark:bg-orange-900/30"
              label="Chefe de Máquinas"
              value={project.chief_engineer}
            />
            <InfoItem
              icon={<Ship className="h-4 w-4 text-cyan-600" />}
              iconBgColor="bg-cyan-100 dark:bg-cyan-900/30"
              label="Tipo"
              value={project.project_type}
            />
            <InfoItem
              icon={<Users className="h-4 w-4 text-indigo-600" />}
              iconBgColor="bg-indigo-100 dark:bg-indigo-900/30"
              label="Tripulação"
              value={project.crew_size?.toString() || null}
            />
          </div>
        </div>
      </div>
    </div>
  );
};