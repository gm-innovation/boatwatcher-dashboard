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

// Maritime hubs – anchor coordinates placed IN the coastal features.
// Guanabara Bay: RJ path indent x≈494 y≈426 (west shore), east cape x≈515 y≈431.
// Bay water center ≈ x:502 y:428.  Markers sit inside the bay reentrance.
const MARITIME_HUBS = {
  guanabara:  { x: 482, y: 448, label: 'Baía de Guanabara' },    // center of bay reentrance between two coastlines
  angra:      { x: 460, y: 453, label: 'Angra dos Reis' },        // south RJ coast
  macae:      { x: 500, y: 418, label: 'Macaé' },                 // NE RJ coast
  acu:        { x: 500, y: 413, label: 'Porto do Açu' },          // São João da Barra
  vitoria:    { x: 521, y: 413, label: 'Vitória' },               // ES coast (path ≈520,412)
  aracruz:    { x: 518, y: 416, label: 'Aracruz' },               // ES coast south of Vitória
  santos:     { x: 438, y: 462, label: 'Santos' },                // SP coast
  suape:      { x: 598, y: 215, label: 'Suape' },                 // PE coast
  paraguacu:  { x: 540, y: 290, label: 'Paraguaçu' },             // BA coast
  rio_grande: { x: 315, y: 618, label: 'Rio Grande' },            // RS coast
  itajai:     { x: 382, y: 518, label: 'Itajaí / Navegantes' },   // SC coast
  belem:      { x: 355, y: 110, label: 'Belém / Barcarena' },     // PA coast
} as const;

// Dictionary: normalized location name → SVG coordinates (raw viewBox coords)
const LOCATION_COORDS: Record<string, { x: number; y: number; label: string }> = {
  // === Cidades principais (interior / capitais) ===
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
  'macapa':           { x: 320, y: 40, label: 'Macapá' },
  'porto velho':      { x: 140, y: 210, label: 'Porto Velho' },
  'cuiaba':           { x: 270, y: 310, label: 'Cuiabá' },
  'goiania':          { x: 370, y: 340, label: 'Goiânia' },
  'brasilia':         { x: 410, y: 330, label: 'Brasília' },
  'belo horizonte':   { x: 460, y: 370, label: 'Belo Horizonte' },
  'campo grande':     { x: 280, y: 400, label: 'Campo Grande' },
  'curitiba':         { x: 360, y: 470, label: 'Curitiba' },
  'florianopolis':    { x: 370, y: 520, label: 'Florianópolis' },
  'porto alegre':     { x: 335, y: 560, label: 'Porto Alegre' },

  // === Cidades costeiras / portuárias (coordenadas marítimas) ===
  'rio de janeiro':   { ...MARITIME_HUBS.guanabara, label: 'Rio de Janeiro' },
  'niteroi':          { ...MARITIME_HUBS.guanabara, label: 'Niterói' },
  'sao goncalo':      { ...MARITIME_HUBS.guanabara, label: 'São Gonçalo' },
  'vitoria':          { ...MARITIME_HUBS.vitoria,   label: 'Vitória' },
  'santos':           { ...MARITIME_HUBS.santos,    label: 'Santos' },
  'guaruja':          { ...MARITIME_HUBS.santos,    label: 'Guarujá' },
  'sao paulo':        { x: 400, y: 440, label: 'São Paulo' },
  'paranagua':        { x: 380, y: 475, label: 'Paranaguá' },
  'itajai':           { ...MARITIME_HUBS.itajai,    label: 'Itajaí' },
  'navegantes':       { ...MARITIME_HUBS.itajai,    label: 'Navegantes' },
  'rio grande':       { ...MARITIME_HUBS.rio_grande, label: 'Rio Grande' },
  'barcarena':        { ...MARITIME_HUBS.belem,     label: 'Barcarena' },
  'angra dos reis':   { ...MARITIME_HUBS.angra,     label: 'Angra dos Reis' },
  'macae':            { ...MARITIME_HUBS.macae,     label: 'Macaé' },
  'aracruz':          { ...MARITIME_HUBS.aracruz,   label: 'Aracruz' },
  'suape':            { ...MARITIME_HUBS.suape,     label: 'Suape' },
  'ipojuca':          { ...MARITIME_HUBS.suape,     label: 'Ipojuca' },
  'maragogipe':       { ...MARITIME_HUBS.paraguacu, label: 'Maragogipe' },
  'sao joao da barra':{ ...MARITIME_HUBS.acu,      label: 'São João da Barra' },
  'aracatuba':        { x: 355, y: 440, label: 'Araçatuba' },

  // === Estaleiros – Baía de Guanabara ===
  'renave':           { ...MARITIME_HUBS.guanabara, label: 'Estaleiro Renave' },
  'brasfels':         { ...MARITIME_HUBS.angra,     label: 'Estaleiro Brasfels' },
  'keppel':           { ...MARITIME_HUBS.angra,     label: 'Keppel Fels' },
  'maua':             { ...MARITIME_HUBS.guanabara, label: 'Estaleiro Mauá' },
  'inhauma':          { ...MARITIME_HUBS.guanabara, label: 'Estaleiro Inhaúma' },
  'brasa':            { ...MARITIME_HUBS.guanabara, label: 'Estaleiro Brasa' },
  'utc':              { ...MARITIME_HUBS.guanabara, label: 'Estaleiro UTC' },
  'triunfo':          { ...MARITIME_HUBS.guanabara, label: 'Estaleiro Triunfo' },
  'mac laren':        { ...MARITIME_HUBS.guanabara, label: 'Estaleiro Mac Laren' },
  'maclaren':         { ...MARITIME_HUBS.guanabara, label: 'Estaleiro Mac Laren' },
  'alianca':          { ...MARITIME_HUBS.guanabara, label: 'Estaleiro Aliança' },
  'thomaz':           { ...MARITIME_HUBS.guanabara, label: 'Estaleiro Thomaz' },

  // === Estaleiros – Angra dos Reis ===
  'verolme':          { ...MARITIME_HUBS.angra,     label: 'Damen Verolme' },
  'damen':            { ...MARITIME_HUBS.angra,     label: 'Damen Verolme' },

  // === Estaleiros – Suape / PE ===
  'atlantico sul':    { ...MARITIME_HUBS.suape,     label: 'Estaleiro Atlântico Sul' },
  'eas':              { ...MARITIME_HUBS.suape,     label: 'EAS' },
  'vard':             { ...MARITIME_HUBS.suape,     label: 'Estaleiro Vard Promar' },
  'promar':           { ...MARITIME_HUBS.suape,     label: 'Vard Promar' },

  // === Estaleiros – ES ===
  'jurong':           { ...MARITIME_HUBS.aracruz,   label: 'Estaleiro Jurong Aracruz' },

  // === Estaleiros – BA ===
  'osx':              { ...MARITIME_HUBS.paraguacu, label: 'Estaleiro OSX' },
  'enseada':          { ...MARITIME_HUBS.paraguacu, label: 'Enseada Paraguaçu' },
  'paraguacu':        { ...MARITIME_HUBS.paraguacu, label: 'Enseada Paraguaçu' },

  // === Estaleiros – RS ===
  'erg':              { ...MARITIME_HUBS.rio_grande, label: 'Estaleiro Rio Grande' },
  'qgi':              { ...MARITIME_HUBS.rio_grande, label: 'QGI Rio Grande' },

  // === Estaleiros – SP ===
  'wilson sons':      { ...MARITIME_HUBS.santos,    label: 'Estaleiro Wilson Sons' },

  // === Estaleiros – SC ===
  'navship':          { ...MARITIME_HUBS.itajai,    label: 'Estaleiro Navship' },
  'detroit':          { ...MARITIME_HUBS.itajai,    label: 'Estaleiro Detroit' },
  'oceana':           { ...MARITIME_HUBS.itajai,    label: 'Estaleiro Oceana' },

  // === Estaleiros – Macaé / Norte RJ ===
  'imbetiba':         { ...MARITIME_HUBS.macae,     label: 'Base de Imbetiba' },
  'porto do acu':     { ...MARITIME_HUBS.acu,       label: 'Porto do Açu' },
  'acu':              { ...MARITIME_HUBS.acu,       label: 'Porto do Açu' },

  // === Belém / PA ===
  'sermetal':         { ...MARITIME_HUBS.belem,     label: 'SERMETAL' },

  // === Araçatuba / SP interior ===
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
                    <image
                      href="/ship-icon.png"
                      x={m.x - m.radius}
                      y={m.y - m.radius}
                      width={m.radius * 2}
                      height={m.radius * 2}
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
