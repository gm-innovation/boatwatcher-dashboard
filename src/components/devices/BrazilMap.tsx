import { useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Maximize2, MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Maritime hubs with real lat/lng
const MARITIME_HUBS = {
  guanabara:  { lat: -22.90, lng: -43.17, label: 'Baía de Guanabara' },
  angra:      { lat: -23.00, lng: -44.32, label: 'Angra dos Reis' },
  macae:      { lat: -22.37, lng: -41.79, label: 'Macaé' },
  acu:        { lat: -21.83, lng: -41.05, label: 'Porto do Açu' },
  vitoria:    { lat: -20.32, lng: -40.34, label: 'Vitória' },
  aracruz:    { lat: -19.82, lng: -40.27, label: 'Aracruz' },
  santos:     { lat: -23.96, lng: -46.33, label: 'Santos' },
  suape:      { lat: -8.39,  lng: -35.06, label: 'Suape' },
  paraguacu:  { lat: -12.88, lng: -38.88, label: 'Paraguaçu' },
  rio_grande: { lat: -32.05, lng: -52.10, label: 'Rio Grande' },
  itajai:     { lat: -26.91, lng: -48.67, label: 'Itajaí / Navegantes' },
  belem:      { lat: -1.46,  lng: -48.50, label: 'Belém / Barcarena' },
} as const;

const LOCATION_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  'manaus':           { lat: -3.12,  lng: -60.02, label: 'Manaus' },
  'belem':            { lat: -1.46,  lng: -48.50, label: 'Belém' },
  'sao luis':         { lat: -2.53,  lng: -44.28, label: 'São Luís' },
  'fortaleza':        { lat: -3.72,  lng: -38.53, label: 'Fortaleza' },
  'natal':            { lat: -5.79,  lng: -35.21, label: 'Natal' },
  'joao pessoa':      { lat: -7.12,  lng: -34.86, label: 'João Pessoa' },
  'recife':           { lat: -8.05,  lng: -34.87, label: 'Recife' },
  'maceio':           { lat: -9.67,  lng: -35.74, label: 'Maceió' },
  'aracaju':          { lat: -10.91, lng: -37.07, label: 'Aracaju' },
  'salvador':         { lat: -12.97, lng: -38.51, label: 'Salvador' },
  'macapa':           { lat: 0.03,   lng: -51.07, label: 'Macapá' },
  'porto velho':      { lat: -8.76,  lng: -63.90, label: 'Porto Velho' },
  'cuiaba':           { lat: -15.60, lng: -56.10, label: 'Cuiabá' },
  'goiania':          { lat: -16.69, lng: -49.25, label: 'Goiânia' },
  'brasilia':         { lat: -15.78, lng: -47.93, label: 'Brasília' },
  'belo horizonte':   { lat: -19.92, lng: -43.94, label: 'Belo Horizonte' },
  'campo grande':     { lat: -20.44, lng: -54.65, label: 'Campo Grande' },
  'curitiba':         { lat: -25.43, lng: -49.27, label: 'Curitiba' },
  'florianopolis':    { lat: -27.60, lng: -48.55, label: 'Florianópolis' },
  'porto alegre':     { lat: -30.03, lng: -51.23, label: 'Porto Alegre' },
  'rio de janeiro':   { ...MARITIME_HUBS.guanabara, label: 'Rio de Janeiro' },
  'niteroi':          { ...MARITIME_HUBS.guanabara, label: 'Niterói' },
  'sao goncalo':      { ...MARITIME_HUBS.guanabara, label: 'São Gonçalo' },
  'vitoria':          { ...MARITIME_HUBS.vitoria,   label: 'Vitória' },
  'santos':           { ...MARITIME_HUBS.santos,    label: 'Santos' },
  'guaruja':          { ...MARITIME_HUBS.santos,    label: 'Guarujá' },
  'sao paulo':        { lat: -23.55, lng: -46.63, label: 'São Paulo' },
  'paranagua':        { lat: -25.52, lng: -48.51, label: 'Paranaguá' },
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
  'sao joao da barra':{ ...MARITIME_HUBS.acu,       label: 'São João da Barra' },
  'aracatuba':        { lat: -21.21, lng: -50.43, label: 'Araçatuba' },
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
  'verolme':          { ...MARITIME_HUBS.angra,     label: 'Damen Verolme' },
  'damen':            { ...MARITIME_HUBS.angra,     label: 'Damen Verolme' },
  'atlantico sul':    { ...MARITIME_HUBS.suape,     label: 'Estaleiro Atlântico Sul' },
  'eas':              { ...MARITIME_HUBS.suape,     label: 'EAS' },
  'vard':             { ...MARITIME_HUBS.suape,     label: 'Estaleiro Vard Promar' },
  'promar':           { ...MARITIME_HUBS.suape,     label: 'Vard Promar' },
  'jurong':           { ...MARITIME_HUBS.aracruz,   label: 'Estaleiro Jurong Aracruz' },
  'osx':              { ...MARITIME_HUBS.paraguacu, label: 'Estaleiro OSX' },
  'enseada':          { ...MARITIME_HUBS.paraguacu, label: 'Enseada Paraguaçu' },
  'paraguacu':        { ...MARITIME_HUBS.paraguacu, label: 'Enseada Paraguaçu' },
  'erg':              { ...MARITIME_HUBS.rio_grande, label: 'Estaleiro Rio Grande' },
  'qgi':              { ...MARITIME_HUBS.rio_grande, label: 'QGI Rio Grande' },
  'wilson sons':      { ...MARITIME_HUBS.santos,    label: 'Estaleiro Wilson Sons' },
  'navship':          { ...MARITIME_HUBS.itajai,    label: 'Estaleiro Navship' },
  'detroit':          { ...MARITIME_HUBS.itajai,    label: 'Estaleiro Detroit' },
  'oceana':           { ...MARITIME_HUBS.itajai,    label: 'Estaleiro Oceana' },
  'imbetiba':         { ...MARITIME_HUBS.macae,     label: 'Base de Imbetiba' },
  'porto do acu':     { ...MARITIME_HUBS.acu,       label: 'Porto do Açu' },
  'acu':              { ...MARITIME_HUBS.acu,       label: 'Porto do Açu' },
  'sermetal':         { ...MARITIME_HUBS.belem,     label: 'SERMETAL' },
  'rio tiete':        { lat: -21.21, lng: -50.43, label: 'Estaleiro Rio Tietê' },
};

function normalizeString(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function findCityCoords(location: string | null): { lat: number; lng: number; label: string } | null {
  if (!location) return null;
  const normalized = normalizeString(location);
  if (LOCATION_COORDS[normalized]) return LOCATION_COORDS[normalized];
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (normalized.includes(key) || key.includes(normalized)) return coords;
  }
  const words = normalized.split(/[\s,\-\/]+/).filter(w => w.length > 2);
  for (const word of words) {
    if (LOCATION_COORDS[word]) return LOCATION_COORDS[word];
    for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
      if (key.includes(word) || word.includes(key)) return coords;
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

function createShipIcon(color: string, size: number = 32) {
  return L.divIcon({
    className: 'leaflet-ship-marker',
    html: `
      <div class="ship-marker-container" style="position:relative;width:${size}px;height:${size}px;">
        <div class="ship-pulse" style="
          position:absolute;top:50%;left:50%;
          transform:translate(-50%,-50%);
          width:${size}px;height:${size}px;
          border-radius:50%;
          background:${color};
          animation:marker-pulse 2s infinite;
        "></div>
        <img src="/ship-icon.png" style="
          position:absolute;top:50%;left:50%;
          transform:translate(-50%,-50%);
          width:${size * 0.7}px;height:${size * 0.7}px;
        " />
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function buildPopupHtml(m: { name: string; label: string; color: string; onlineDevices: number; totalDevices: number; health: string }) {
  const statusLabel = m.health === 'online' ? 'Operacional' : m.health === 'partial' ? 'Parcial' : 'Crítico';
  return `<div style="font-size:12px;max-width:200px;">
    <p style="font-weight:600;margin:0 0 2px">${m.name}</p>
    <p style="color:#888;margin:0 0 2px">${m.label}</p>
    <p style="margin:0"><span style="color:${m.color}">●</span> ${m.onlineDevices}/${m.totalDevices} dispositivos online</p>
    <p style="color:#888;margin:2px 0 0">Status: ${statusLabel}</p>
  </div>`;
}

export function BrazilMap({ projects, onExpandClick, compact = false }: BrazilMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const markers = useMemo(() => {
    return projects
      .map(p => {
        const coords = findCityCoords(p.location);
        if (!coords) return null;
        const health = p.totalDevices === 0 ? 'none'
          : p.onlineDevices === p.totalDevices ? 'online'
          : p.onlineDevices > 0 ? 'partial' : 'offline';
        const color = health === 'online' ? COLOR_ONLINE : health === 'partial' ? COLOR_PARTIAL : COLOR_OFFLINE;
        return { ...p, ...coords, health, color };
      })
      .filter(Boolean) as (MapProjectData & { lat: number; lng: number; label: string; health: string; color: string })[];
  }, [projects]);

  const height = compact ? 200 : 280;

  // Init map
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      center: [-14.2, -51.9],
      zoom: compact ? 3 : 4,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: false,
      doubleClickZoom: false,
      touchZoom: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapInstanceRef.current = null; markersLayerRef.current = null; };
  }, [compact]);

  // Update markers
  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markers.forEach(m => {
      L.marker([m.lat, m.lng], { icon: createShipIcon(m.color, compact ? 24 : 32) })
        .bindPopup(buildPopupHtml(m))
        .addTo(layer);
    });
  }, [markers, compact]);

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
        <div ref={mapRef} style={{ height, width: '100%' }} className="rounded-md overflow-hidden" />
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
