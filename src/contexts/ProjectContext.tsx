import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { fetchProjects as fetchProjectsFromProvider, fetchCurrentCompanyByUserId } from '@/hooks/useDataProvider';
import { useAuthContext } from '@/contexts/AuthContext';
import { useRuntimeProfile } from '@/hooks/useRuntimeProfile';

interface Project {
  id: string;
  name: string;
  client_id: string | null;
  status: string | null;
  client?: {
    id?: string;
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
  lastUpdate: Date;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  handleRefresh: () => void;
  registerRefreshCallback: (cb: () => void) => () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);
const PROJECT_STORAGE_KEY = 'dockcheck:selected-project-id';

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const { user, role } = useAuthContext();
  const { dataMode } = useRuntimeProfile();
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(() => localStorage.getItem(PROJECT_STORAGE_KEY));
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [syncRefreshKey, setSyncRefreshKey] = useState(0);
  const refreshCallbacksRef = useRef<(() => void)[]>([]);

  const setSelectedProjectId = useCallback((id: string | null) => {
    setSelectedProjectIdState(id);
    if (id) {
      localStorage.setItem(PROJECT_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(PROJECT_STORAGE_KEY);
    }
  }, []);

  const toggleFullscreen = () => {
    setIsFullscreenMode((prev) => !prev);
  };

  const handleRefresh = useCallback(() => {
    refreshCallbacksRef.current.forEach((cb) => cb());
    setLastUpdate(new Date());
  }, []);

  const registerRefreshCallback = useCallback((cb: () => void) => {
    refreshCallbacksRef.current.push(cb);
    return () => {
      refreshCallbacksRef.current = refreshCallbacksRef.current.filter((fn) => fn !== cb);
    };
  }, []);

  useEffect(() => {
    const handleSyncUpdated = () => {
      setSyncRefreshKey((prev) => prev + 1);
      setLastUpdate(new Date());
    };

    window.addEventListener('desktop-sync-updated', handleSyncUpdated);
    return () => window.removeEventListener('desktop-sync-updated', handleSyncUpdated);
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Admin (Super Admin) uses bypassLocal to see all projects from Supabase
        const isAdmin = role === 'admin';
        const providerProjects = ((await fetchProjectsFromProvider({ bypassLocal: isAdmin })) || []) as Project[];

        if (isAdmin) { // Use isAdmin variable here

          setProjects(providerProjects);
          return;
        }

        const companyAccess = await fetchCurrentCompanyByUserId(user.id);
        const companyId = companyAccess?.company_id || null;
        setProjects(providerProjects.filter((project) => project.client_id === companyId));
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user, role, syncRefreshKey, dataMode]);

  useEffect(() => {
    if (!projects.length) {
      setSelectedProject(null);
      if (selectedProjectId) {
        setSelectedProjectId(null);
      }
      return;
    }

    const nextSelectedProject = selectedProjectId
      ? projects.find((project) => project.id === selectedProjectId) || null
      : null;

    if (nextSelectedProject) {
      setSelectedProject(nextSelectedProject);
      return;
    }

    const fallbackProject = projects[0];
    setSelectedProject(fallbackProject);
    setSelectedProjectId(fallbackProject.id);
  }, [projects, selectedProjectId, setSelectedProjectId]);

  return (
    <ProjectContext.Provider
      value={{
        selectedProjectId,
        setSelectedProjectId,
        selectedProject,
        projects,
        loading,
        isFullscreenMode,
        toggleFullscreen,
        lastUpdate,
        autoRefresh,
        setAutoRefresh,
        handleRefresh,
        registerRefreshCallback,
      }}
    >
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
