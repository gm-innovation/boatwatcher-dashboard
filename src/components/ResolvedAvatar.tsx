import { User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useResolvedUrl } from '@/hooks/useResolvedUrl';
import { cn } from '@/lib/utils';

type ResolvedAvatarFallback = 'icon' | 'initials';

interface ResolvedAvatarProps {
  photoUrl?: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
  iconClassName?: string;
  fallback?: ResolvedAvatarFallback;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function ResolvedAvatar({
  photoUrl,
  name,
  className,
  fallbackClassName,
  iconClassName,
  fallback = 'icon',
}: ResolvedAvatarProps) {
  const resolvedUrl = useResolvedUrl(photoUrl);

  return (
    <Avatar className={className}>
      {resolvedUrl ? <AvatarImage src={resolvedUrl} alt={name} /> : null}
      <AvatarFallback className={fallbackClassName}>
        {fallback === 'initials' ? getInitials(name) : <User className={cn('h-4 w-4', iconClassName)} />}
      </AvatarFallback>
    </Avatar>
  );
}
