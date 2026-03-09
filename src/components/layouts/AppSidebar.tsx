import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Building2, 
  Settings,
  ChevronDown,
  UserCheck,
  Briefcase,
  FileCheck,
  Server,
  FolderKanban,
  Shield,
  Activity,
  Cog,
  Wifi
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from './NavLink';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AppRole } from '@/types/supabase';

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

const adminSubItems = [
  { title: 'Dispositivos', url: '/admin/devices', icon: Server },
  { title: 'Conectividade', url: '/admin/connectivity', icon: Wifi },
  { title: 'Projetos', url: '/admin/projects', icon: FolderKanban },
  { title: 'Usuários', url: '/admin/users', icon: Shield },
  { title: 'Configurações', url: '/admin/settings', icon: Cog },
  { title: 'Auditoria', url: '/admin/audit', icon: Activity },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  
  const currentPath = location.pathname;
  const isPeopleActive = currentPath.startsWith('/people');
  const isAdminActive = currentPath.startsWith('/admin');
  const isCompanyPortalActive = currentPath.startsWith('/company-portal');

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();
        setUserRole(data?.role as AppRole || null);
      }
    };
    fetchUserRole();
  }, []);

  const isActive = (path: string, end?: boolean) => {
    if (end) return currentPath === path;
    return currentPath.startsWith(path);
  };

  const isAdmin = userRole === 'admin';
  const isCompanyAdmin = userRole === 'company_admin';

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Main Navigation */}
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

        {/* People Management - Admin only */}
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

        {/* Company Portal - Company Admin only */}
        {isCompanyAdmin && (
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

        {/* Administration - Admin only */}
        {isAdmin && (
          <SidebarGroup>
            <Collapsible defaultOpen={isAdminActive}>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md px-2 py-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>Administração</span>
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
