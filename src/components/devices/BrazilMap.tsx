import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Maximize2, MapPin } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BRAZIL_STATES, SVG_VIEWBOX } from './brazilStatesData';
import { spreadOverlappingMarkers } from './mapUtils';

// Re-export for backward compat
export { BRAZIL_STATES, SVG_VIEWBOX };
export const SVG_WIDTH = 622;
export const SVG_HEIGHT = 648;
// Keep BRAZIL_PATH export as empty (no longer a single path)
export const BRAZIL_PATH = '';

// Dictionary: normalized location name → SVG coordinates (raw viewBox coords)
const LOCATION_COORDS: Record<string, { x: number; y: number; label: string }> = {
  // === Cidades principais ===
  'manaus':           { x: 120, y: 120, label: 'Manaus' },
  'belem':            { x: 355, y: 110, label: 'Belém' },
  'sao luis':         { x: 430, y: 140, label: 'São Luís' },
  'fortaleza':        { x: 548, y: 148, label: 'Fortaleza' },
  'natal':            { x: 590, y: 170, label: 'Natal' },
  'joao pessoa':      { x: 595, y: 185, label: 'João Pessoa' },
  'recife':           { x: 590, y: 200, label: 'Recife' },
  'maceio':           { x: 600, y: 225, label: 'Maceió' },
  'aracaju':          { x: 580, y: 248, label: 'Aracaju' },
  'salvador':         { x: 545, y: 280, label: 'Salvador' },
  'vitoria':          { x: 530, y: 395, label: 'Vitória' },
  'rio de janeiro':   { x: 500, y: 435, label: 'Rio de Janeiro' },
  'niteroi':          { x: 505, y: 432, label: 'Niterói' },
  'sao goncalo':      { x: 503, y: 430, label: 'São Gonçalo' },
  'angra dos reis':   { x: 480, y: 445, label: 'Angra dos Reis' },
  'santos':           { x: 420, y: 460, label: 'Santos' },
  'sao paulo':        { x: 400, y: 445, label: 'São Paulo' },
  'guaruja':          { x: 425, y: 462, label: 'Guarujá' },
  'paranagua':        { x: 380, y: 475, label: 'Paranaguá' },
  'curitiba':         { x: 360, y: 470, label: 'Curitiba' },
  'florianopolis':    { x: 370, y: 520, label: 'Florianópolis' },
  'itajai':           { x: 375, y: 510, label: 'Itajaí' },
  'navegantes':       { x: 373, y: 512, label: 'Navegantes' },
  'porto alegre':     { x: 335, y: 560, label: 'Porto Alegre' },
  'rio grande':       { x: 310, y: 610, label: 'Rio Grande' },
  'macapa':           { x: 320, y: 40, label: 'Macapá' },
  'porto velho':      { x: 140, y: 210, label: 'Porto Velho' },
  'cuiaba':           { x: 270, y: 310, label: 'Cuiabá' },
  'goiania':          { x: 370, y: 340, label: 'Goiânia' },
  'brasilia':         { x: 410, y: 330, label: 'Brasília' },
  'belo horizonte':   { x: 460, y: 370, label: 'Belo Horizonte' },
  'campo grande':     { x: 280, y: 400, label: 'Campo Grande' },
  'macae':            { x: 520, y: 420, label: 'Macaé' },
  'aracruz':          { x: 528, y: 400, label: 'Aracruz' },
  'suape':            { x: 593, y: 210, label: 'Suape' },
  'ipojuca':          { x: 593, y: 210, label: 'Ipojuca' },
  'maragogipe':       { x: 538, y: 285, label: 'Maragogipe' },
  'barcarena':        { x: 350, y: 115, label: 'Barcarena' },
  'sao joao da barra':{ x: 525, y: 415, label: 'São João da Barra' },
  'aracatuba':        { x: 355, y: 440, label: 'Araçatuba' },
  // === Estaleiros offshore ===
  'renave':           { x: 505, y: 435, label: 'Estaleiro Renave' },
  'brasfels':         { x: 480, y: 445, label: 'Estaleiro Brasfels' },
  'keppel':           { x: 478, y: 447, label: 'Keppel Fels' },
  'maua':             { x: 505, y: 433, label: 'Estaleiro Mauá' },
  'inhauma':          { x: 498, y: 430, label: 'Estaleiro Inhaúma' },
  'brasa':            { x: 500, y: 432, label: 'Estaleiro Brasa' },
  'atlantico sul':    { x: 593, y: 210, label: 'Estaleiro Atlântico Sul' },
  'eas':              { x: 593, y: 210, label: 'EAS' },
  'jurong':           { x: 528, y: 400, label: 'Estaleiro Jurong Aracruz' },
  'osx':              { x: 538, y: 285, label: 'Estaleiro OSX' },
  'enseada':          { x: 538, y: 285, label: 'Enseada Paraguaçu' },
  'paraguacu':        { x: 538, y: 285, label: 'Enseada Paraguaçu' },
  'erg':              { x: 310, y: 610, label: 'Estaleiro Rio Grande' },
  'qgi':              { x: 310, y: 610, label: 'QGI Rio Grande' },
  'wilson sons':      { x: 425, y: 462, label: 'Estaleiro Wilson Sons' },
  'vard':             { x: 595, y: 212, label: 'Estaleiro Vard Promar' },
  'promar':           { x: 595, y: 212, label: 'Vard Promar' },
  'utc':              { x: 506, y: 434, label: 'Estaleiro UTC' },
  'triunfo':          { x: 506, y: 434, label: 'Estaleiro Triunfo' },
  'mac laren':        { x: 504, y: 436, label: 'Estaleiro Mac Laren' },
  'maclaren':         { x: 504, y: 436, label: 'Estaleiro Mac Laren' },
  'alianca':          { x: 507, y: 434, label: 'Estaleiro Aliança' },
  'imbetiba':         { x: 522, y: 418, label: 'Base de Imbetiba' },
  'sermetal':         { x: 350, y: 115, label: 'SERMETAL' },
  'navship':          { x: 373, y: 512, label: 'Estaleiro Navship' },
  'detroit':          { x: 375, y: 510, label: 'Estaleiro Detroit' },
  'oceana':           { x: 376, y: 511, label: 'Estaleiro Oceana' },
  'verolme':          { x: 479, y: 446, label: 'Damen Verolme' },
  'damen':            { x: 479, y: 446, label: 'Damen Verolme' },
  'thomaz':           { x: 503, y: 430, label: 'Estaleiro Thomaz' },
  'porto do acu':     { x: 525, y: 415, label: 'Porto do Açu' },
  'acu':              { x: 525, y: 415, label: 'Porto do Açu' },
  'rio tiete':        { x: 355, y: 440, label: 'Estaleiro Rio Tietê' },
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
  
  if (LOCATION_COORDS[normalized]) return LOCATION_COORDS[normalized];
  
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }
  
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

const SHIP_ICON_SIZE = 20; // base icon size in SVG units

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
    const raw = projects
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
    return spreadOverlappingMarkers(raw, 25);
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
            viewBox={SVG_VIEWBOX}
            className="w-full"
            style={{ height, maxHeight: height }}
            aria-label="Mapa do Brasil com projetos ativos"
          >
            <rect x="-5" y="-5" width="622" height="648" fill="transparent" />
            
            {/* Brazil states */}
            {Object.entries(BRAZIL_STATES).map(([abbr, d]) => (
              <path
                key={abbr}
                d={d}
                fill="hsl(var(--muted))"
                stroke="hsl(var(--border))"
                strokeWidth="1"
                opacity={0.7}
              />
            ))}
            
            {/* Connection lines for spread markers */}
            {markers.filter(m => m.wasSpread).map((m) => (
              <line
                key={`line-${m.id}`}
                x1={m.originalX}
                y1={m.originalY}
                x2={m.x}
                y2={m.y}
                stroke="hsl(var(--foreground))"
                strokeWidth="0.8"
                opacity={0.2}
                strokeDasharray="3,2"
              />
            ))}
            
            {/* Markers */}
            {markers.map((m) => (
              <Tooltip key={m.id}>
                <TooltipTrigger asChild>
                  <g style={{ cursor: 'pointer' }}>
                    <circle cx={m.x} cy={m.y} r={m.radius + 4} fill={m.color} opacity={0.3}>
                      <animate attributeName="r" from={String(m.radius)} to={String(m.radius + 12)} dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <path
                      d={SHIP_PATH}
                      transform={`translate(${m.x},${m.y}) scale(${m.radius / 8})`}
                      fill={m.color}
                      stroke="hsl(var(--background))"
                      strokeWidth={2 / (m.radius / 8)}
                    />
                    {!compact && (
                      <text x={m.x + m.radius + 4} y={m.y + 3} fontSize="9" fill="hsl(var(--foreground))" fontWeight="500" opacity={0.8}>
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

export { findCityCoords, LOCATION_COORDS, LOCATION_COORDS as CITY_COORDS };
