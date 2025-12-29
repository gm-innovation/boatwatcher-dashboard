import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Project {
  id: string;
  name: string;
  client_id: string | null;
  status: string | null;
  client?: {
    id: string;
    name: string;
    logo_url_light: string | null;
    logo_url_dark: string | null;
  } | null;
}

interface ProjectContextType {
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selectedProject: Project | null;
  projects: Project[];
  loading: boolean;
  isFullscreenMode: boolean;
  toggleFullscreen: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreenMode(prev => !prev);
  };

  // Fetch projects when component mounts
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('projects')
          .select(`
            id,
            name,
            client_id,
            status,
            client:companies (
              id,
              name,
              logo_url_light,
              logo_url_dark
            )
          `)
          .order('name');

        if (error) {
          console.error('Error fetching projects:', error);
          return;
        }

        // Transform data to match Project type
        const transformedProjects = (data || []).map((project: any) => ({
          id: project.id,
          name: project.name,
          client_id: project.client_id,
          status: project.status,
          client: project.client
        }));

        setProjects(transformedProjects);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Update selected project when ID changes
  useEffect(() => {
    if (selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId);
      setSelectedProject(project || null);
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId, projects]);

  return (
    <ProjectContext.Provider value={{
      selectedProjectId,
      setSelectedProjectId,
      selectedProject,
      projects,
      loading,
      isFullscreenMode,
      toggleFullscreen
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
