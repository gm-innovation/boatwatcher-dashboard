import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

interface AccessPoint {
  id: string;
  name: string;
  access_location: string;
  direction_mode: string;
  is_active: boolean;
}

interface AccessPointSelectorProps {
  value: string | null;
  onChange: (point: AccessPoint | null) => void;
}

export function AccessPointSelector({ value, onChange }: AccessPointSelectorProps) {
  const { data: points = [] } = useQuery({
    queryKey: ['manual_access_points'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('manual_access_points')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as AccessPoint[];
    },
  });

  const selected = points.find(p => p.id === value);

  return (
    <div className="space-y-2">
      <Select
        value={value || ''}
        onValueChange={id => {
          const point = points.find(p => p.id === id) || null;
          onChange(point);
        }}
      >
        <SelectTrigger className="h-12">
          <SelectValue placeholder="Selecione o ponto de controle" />
        </SelectTrigger>
        <SelectContent>
          {points.map(p => (
            <SelectItem key={p.id} value={p.id}>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {p.name}
                <Badge variant="outline" className="ml-1 text-xs">
                  {p.access_location === 'bordo' ? 'Bordo' : 'Dique'}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
