import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  end?: boolean;
}

export const NavLink = ({ 
  to, 
  children, 
  className = '', 
  activeClassName = 'bg-sidebar-accent text-sidebar-accent-foreground',
  end = false 
}: NavLinkProps) => {
  const location = useLocation();
  const isActive = end 
    ? location.pathname === to 
    : location.pathname.startsWith(to);

  return (
    <Link 
      to={to} 
      className={cn(className, isActive && activeClassName)}
    >
      {children}
    </Link>
  );
};
