import { useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { findCityCoords, type MapProjectData } from './BrazilMap';

const COLOR_ONLINE = '#22c55e';
const COLOR_OFFLINE = '#ef4444';
const COLOR_PARTIAL = '#eab308';

interface BrazilMapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: MapProjectData[];
}

function createShipIcon(color: string, size: number = 36) {
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

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export function BrazilMapModal({ open, onOpenChange, projects }: BrazilMapModalProps) {
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
        return { ...p, ...coords, health, color };
      })
      .filter(Boolean) as (MapProjectData & { lat: number; lng: number; label: string; health: string; color: string })[];
  }, [projects]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">Mapa de Operações</DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Use scroll para zoom e arraste para navegar · {markers.length} projeto(s) no mapa
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {open && (
            <MapContainer
              center={[-14.2, -51.9]}
              zoom={4}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
              zoomControl={true}
            >
              <MapResizer />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {markers.map((m) => (
                <Marker
                  key={m.id}
                  position={[m.lat, m.lng]}
                  icon={createShipIcon(m.color, 36)}
                >
                  <Popup>
                    <div className="text-xs max-w-[200px]">
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-muted-foreground">{m.label}</p>
                      <p>
                        <span style={{ color: m.color }}>●</span>{' '}
                        {m.onlineDevices}/{m.totalDevices} dispositivos online
                      </p>
                      <p className="text-muted-foreground">
                        Status: {m.health === 'online' ? 'Operacional' : m.health === 'partial' ? 'Parcial' : 'Crítico'}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>

        <div className="px-6 py-3 border-t border-border/50 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_ONLINE }} />
            Operacional
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_PARTIAL }} />
            Parcial
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_OFFLINE }} />
            Crítico
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
