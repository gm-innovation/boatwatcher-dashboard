import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Maximize2, MapPin } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Simplified Brazil SVG path (contour)
const BRAZIL_PATH = `M 170 45 L 195 38 L 220 42 L 245 35 L 260 40 L 275 38 L 290 45 L 305 42 L 320 48 L 335 45 L 345 50 L 355 48 L 365 55 L 370 65 L 375 75 L 380 85 L 382 95 L 385 105 L 388 115 L 390 125 L 392 135 L 390 145 L 385 155 L 380 165 L 375 175 L 370 180 L 365 185 L 360 195 L 355 205 L 350 215 L 340 225 L 330 230 L 320 240 L 310 250 L 300 260 L 290 265 L 280 270 L 270 280 L 260 290 L 255 300 L 250 310 L 245 320 L 235 330 L 225 340 L 215 345 L 205 350 L 195 355 L 185 360 L 175 365 L 165 360 L 155 355 L 148 345 L 140 335 L 135 325 L 128 315 L 120 310 L 112 305 L 105 295 L 100 285 L 95 275 L 88 265 L 80 258 L 75 250 L 70 240 L 68 230 L 65 220 L 60 210 L 55 200 L 52 190 L 50 180 L 48 170 L 50 160 L 55 150 L 60 140 L 65 130 L 70 120 L 78 110 L 85 100 L 95 90 L 105 82 L 115 75 L 125 68 L 135 60 L 145 52 L 155 48 L 165 46 Z`;

// ViewBox dimensions for the SVG
const SVG_WIDTH = 450;
const SVG_HEIGHT = 400;

// Dictionary: normalized city/port name → SVG {x, y} coordinates
const LOCATION_COORDS: Record<string, { x: number; y: number; label: string }> = {
  // === Cidades principais ===
  'manaus': { x: 105, y: 85, label: 'Manaus' },
  'belem': { x: 220, y: 55, label: 'Belém' },
  'sao luis': { x: 250, y: 60, label: 'São Luís' },
  'fortaleza': { x: 310, y: 70, label: 'Fortaleza' },
  'natal': { x: 345, y: 85, label: 'Natal' },
  'joao pessoa': { x: 350, y: 95, label: 'João Pessoa' },
  'recife': { x: 358, y: 105, label: 'Recife' },
  'maceio': { x: 365, y: 120, label: 'Maceió' },
  'aracaju': { x: 360, y: 135, label: 'Aracaju' },
  'salvador': { x: 340, y: 155, label: 'Salvador' },
  'vitoria': { x: 340, y: 215, label: 'Vitória' },
  'rio de janeiro': { x: 310, y: 240, label: 'Rio de Janeiro' },
  'niteroi': { x: 315, y: 245, label: 'Niterói' },
  'sao goncalo': { x: 313, y: 241, label: 'São Gonçalo' },
  'angra dos reis': { x: 295, y: 245, label: 'Angra dos Reis' },
  'santos': { x: 270, y: 260, label: 'Santos' },
  'sao paulo': { x: 260, y: 250, label: 'São Paulo' },
  'guaruja': { x: 275, y: 262, label: 'Guarujá' },
  'paranagua': { x: 250, y: 275, label: 'Paranaguá' },
  'curitiba': { x: 240, y: 270, label: 'Curitiba' },
  'florianopolis': { x: 235, y: 290, label: 'Florianópolis' },
  'itajai': { x: 240, y: 285, label: 'Itajaí' },
  'navegantes': { x: 238, y: 287, label: 'Navegantes' },
  'porto alegre': { x: 210, y: 320, label: 'Porto Alegre' },
  'rio grande': { x: 195, y: 345, label: 'Rio Grande' },
  'macapa': { x: 180, y: 45, label: 'Macapá' },
  'porto velho': { x: 80, y: 110, label: 'Porto Velho' },
  'cuiaba': { x: 155, y: 175, label: 'Cuiabá' },
  'goiania': { x: 210, y: 190, label: 'Goiânia' },
  'brasilia': { x: 225, y: 175, label: 'Brasília' },
  'belo horizonte': { x: 285, y: 205, label: 'Belo Horizonte' },
  'campo grande': { x: 160, y: 230, label: 'Campo Grande' },
  'macae': { x: 330, y: 225, label: 'Macaé' },
  'aracruz': { x: 338, y: 210, label: 'Aracruz' },
  'suape': { x: 362, y: 112, label: 'Suape' },
  'ipojuca': { x: 362, y: 112, label: 'Ipojuca' },
  'maragogipe': { x: 335, y: 158, label: 'Maragogipe' },
  'barcarena': { x: 215, y: 55, label: 'Barcarena' },
  'sao joao da barra': { x: 335, y: 220, label: 'São João da Barra' },
  'aracatuba': { x: 205, y: 240, label: 'Araçatuba' },
  // === Estaleiros offshore ===
  'renave': { x: 315, y: 245, label: 'Estaleiro Renave' },
  'brasfels': { x: 295, y: 248, label: 'Estaleiro Brasfels' },
  'keppel': { x: 293, y: 250, label: 'Keppel Fels' },
  'maua': { x: 315, y: 243, label: 'Estaleiro Mauá' },
  'inhauma': { x: 310, y: 240, label: 'Estaleiro Inhaúma' },
  'brasa': { x: 312, y: 242, label: 'Estaleiro Brasa' },
  'atlantico sul': { x: 362, y: 112, label: 'Estaleiro Atlântico Sul' },
  'eas': { x: 362, y: 112, label: 'EAS' },
  'jurong': { x: 338, y: 210, label: 'Estaleiro Jurong Aracruz' },
  'osx': { x: 335, y: 158, label: 'Estaleiro OSX' },
  'enseada': { x: 335, y: 158, label: 'Enseada Paraguaçu' },
  'paraguacu': { x: 335, y: 158, label: 'Enseada Paraguaçu' },
  'erg': { x: 195, y: 345, label: 'Estaleiro Rio Grande' },
  'qgi': { x: 195, y: 345, label: 'QGI Rio Grande' },
  'wilson sons': { x: 275, y: 262, label: 'Estaleiro Wilson Sons' },
  'vard': { x: 362, y: 114, label: 'Estaleiro Vard Promar' },
  'promar': { x: 362, y: 114, label: 'Vard Promar' },
  'utc': { x: 316, y: 244, label: 'Estaleiro UTC' },
  'triunfo': { x: 316, y: 244, label: 'Estaleiro Triunfo' },
  'mac laren': { x: 314, y: 246, label: 'Estaleiro Mac Laren' },
  'maclaren': { x: 314, y: 246, label: 'Estaleiro Mac Laren' },
  'alianca': { x: 317, y: 244, label: 'Estaleiro Aliança' },
  'imbetiba': { x: 332, y: 223, label: 'Base de Imbetiba' },
  'sermetal': { x: 215, y: 55, label: 'SERMETAL' },
  'navship': { x: 238, y: 287, label: 'Estaleiro Navship' },
  'detroit': { x: 240, y: 285, label: 'Estaleiro Detroit' },
  'oceana': { x: 241, y: 286, label: 'Estaleiro Oceana' },
  'verolme': { x: 294, y: 249, label: 'Damen Verolme' },
  'damen': { x: 294, y: 249, label: 'Damen Verolme' },
  'thomaz': { x: 313, y: 241, label: 'Estaleiro Thomaz' },
  'porto do acu': { x: 335, y: 220, label: 'Porto do Açu' },
  'acu': { x: 335, y: 220, label: 'Porto do Açu' },
  'rio tiete': { x: 205, y: 240, label: 'Estaleiro Rio Tietê' },
};

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function findCityCoords(location: string | null): { x: number; y: number; label: string } | null {
  if (!location) return null;
  const normalized = normalizeString(location);
  
  // Exact match
  if (LOCATION_COORDS[normalized]) return LOCATION_COORDS[normalized];
  
  // Check if location contains a known key (e.g. "Estaleiro Renave" contains "renave")
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }
  
  // Word-level match: check each word of location against dictionary keys
  const words = normalized.split(/[\s,\-\/]+/).filter(w => w.length > 2);
  for (const word of words) {
    if (LOCATION_COORDS[word]) return LOCATION_COORDS[word];
    for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
      if (key.includes(word) || word.includes(key)) {
        return coords;
      }
    }
  }
  
  return null;
}

const COLOR_ONLINE = '#22c55e';
const COLOR_OFFLINE = '#ef4444';
const COLOR_PARTIAL = '#eab308';

export type MapProjectData = {
  id: string;
  name: string;
  location: string | null;
  onlineDevices: number;
  totalDevices: number;
};

interface BrazilMapProps {
  projects: MapProjectData[];
  onExpandClick?: () => void;
  compact?: boolean;
}

export function BrazilMap({ projects, onExpandClick, compact = false }: BrazilMapProps) {
  const markers = useMemo(() => {
    return projects
      .map(p => {
        const coords = findCityCoords(p.location);
        if (!coords) return null;
        const health = p.totalDevices === 0 ? 'none'
          : p.onlineDevices === p.totalDevices ? 'online'
          : p.onlineDevices > 0 ? 'partial'
          : 'offline';
        const color = health === 'online' ? COLOR_ONLINE : health === 'partial' ? COLOR_PARTIAL : COLOR_OFFLINE;
        const radius = Math.max(6, Math.min(14, 4 + p.totalDevices * 2));
        return { ...p, ...coords, health, color, radius };
      })
      .filter(Boolean) as (MapProjectData & { x: number; y: number; label: string; health: string; color: string; radius: number })[];
  }, [projects]);

  const height = compact ? 200 : 280;

  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Mapa de Operações
          </CardTitle>
          {onExpandClick && (
            <Button variant="ghost" size="sm" onClick={onExpandClick} className="h-7 px-2 text-xs gap-1">
              <Maximize2 className="h-3.5 w-3.5" />
              Expandir
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <TooltipProvider delayDuration={0}>
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full"
            style={{ height, maxHeight: height }}
            aria-label="Mapa do Brasil com projetos ativos"
          >
            {/* Background */}
            <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="transparent" />
            
            {/* Brazil contour */}
            <path
              d={BRAZIL_PATH}
              fill="hsl(var(--muted))"
              stroke="hsl(var(--border))"
              strokeWidth="1.5"
              opacity={0.7}
            />
            
            {/* State grid lines for visual reference */}
            <line x1="50" y1="200" x2="400" y2="200" stroke="hsl(var(--border))" strokeWidth="0.3" opacity={0.3} />
            <line x1="220" y1="30" x2="220" y2="370" stroke="hsl(var(--border))" strokeWidth="0.3" opacity={0.3} />
            
            {/* Markers */}
            {markers.map((m) => (
              <Tooltip key={m.id}>
                <TooltipTrigger asChild>
                  <g style={{ cursor: 'pointer' }}>
                    {/* Pulse ring */}
                    <circle
                      cx={m.x}
                      cy={m.y}
                      r={m.radius + 4}
                      fill={m.color}
                      opacity={0.3}
                    >
                      <animate
                        attributeName="r"
                        from={String(m.radius)}
                        to={String(m.radius + 12)}
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        from="0.4"
                        to="0"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    
                    {/* Main dot */}
                    <circle
                      cx={m.x}
                      cy={m.y}
                      r={m.radius}
                      fill={m.color}
                      stroke="hsl(var(--background))"
                      strokeWidth="2"
                    />
                    
                    {/* Label */}
                    {!compact && (
                      <text
                        x={m.x + m.radius + 4}
                        y={m.y + 3}
                        fontSize="9"
                        fill="hsl(var(--foreground))"
                        fontWeight="500"
                        opacity={0.8}
                      >
                        {m.name.length > 18 ? m.name.slice(0, 18) + '…' : m.name}
                      </text>
                    )}
                  </g>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-muted-foreground">{m.label}</p>
                  <p>
                    <span style={{ color: m.color }}>●</span>{' '}
                    {m.onlineDevices}/{m.totalDevices} dispositivos online
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </svg>
        </TooltipProvider>
        
        {markers.length === 0 && projects.length > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-1">
            Nenhum projeto com localização mapeada
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export { findCityCoords, CITY_COORDS, SVG_WIDTH, SVG_HEIGHT, BRAZIL_PATH };
