import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  Settings,
  ChevronDown,
  UserCheck,
  Briefcase,
  Server,
  FolderKanban,
  Shield,
  Activity,
  Cog,
  Wifi,
  Bot,
  FileWarning,
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { NavLink } from './NavLink';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usesLocalServer } from '@/lib/runtimeProfile';

const mainNavItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, end: true },
  { title: 'Relatórios', url: '/reports', icon: FileText },
  { title: 'Visitantes', url: '/visitors', icon: UserCheck },
];

const peopleSubItems = [
  { title: 'Trabalhadores', url: '/people/workers', icon: UserCheck },
  { title: 'Empresas', url: '/people/companies', icon: Building2 },
  { title: 'Cargos e Requisitos', url: '/people/job-functions', icon: Briefcase },
];

const webAdminSubItems = [
  { title: 'Dispositivos', url: '/admin/devices', icon: Server },
  { title: 'Conectividade', url: '/admin/connectivity', icon: Wifi },
  { title: 'Projetos', url: '/admin/projects', icon: FolderKanban },
  { title: 'Usuários', url: '/admin/users', icon: Shield },
  { title: 'Configurações', url: '/admin/settings', icon: Cog },
  { title: 'Auditoria', url: '/admin/audit', icon: Activity },
];

const desktopAdminSubItems = [
  { title: 'Dispositivos', url: '/admin/devices', icon: Server },
  { title: 'Agentes', url: '/admin/agents', icon: Bot },
  { title: 'Conectividade', url: '/admin/connectivity', icon: Wifi },
  { title: 'Projetos', url: '/admin/projects', icon: FolderKanban },
  { title: 'Documentos', url: '/admin/documents', icon: FileWarning },
  { title: 'Configurações', url: '/admin/settings', icon: Cog },
];

export function AppSidebar() {
  const location = useLocation();
  const { role } = useAuthContext();
  const isLocalRuntime = usesLocalServer();

  const currentPath = location.pathname;
  const isPeopleActive = currentPath.startsWith('/people');
  const isAdminActive = currentPath.startsWith('/admin');
  const isCompanyPortalActive = currentPath.startsWith('/company-portal');

  const isActive = (path: string, end?: boolean) => {
    if (end) return currentPath === path;
    return currentPath.startsWith(path);
  };

  const isAdmin = role === 'admin' || isLocalRuntime;
  const isCompanyAdmin = role === 'company_admin';
  const adminSubItems = isLocalRuntime ? desktopAdminSubItems : webAdminSubItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url, item.end)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url} end={item.end}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <Collapsible defaultOpen={isPeopleActive}>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md px-2 py-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Gestão de Pessoas</span>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {peopleSubItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.url)}
                          tooltip={item.title}
                        >
                          <NavLink to={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {isCompanyAdmin && !isLocalRuntime && (
          <SidebarGroup>
            <SidebarGroupLabel>Portal da Empresa</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isCompanyPortalActive}
                    tooltip="Portal da Empresa"
                  >
                    <NavLink to="/company-portal">
                      <Building2 className="h-4 w-4" />
                      <span>Minha Empresa</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup>
            <Collapsible defaultOpen={isAdminActive}>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md px-2 py-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>{isLocalRuntime ? 'Operação Local' : 'Administração'}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminSubItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.url)}
                          tooltip={item.title}
                        >
                          <NavLink to={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
