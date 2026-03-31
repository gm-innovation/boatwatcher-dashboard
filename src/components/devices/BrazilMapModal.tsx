import { useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { findCityCoords, type MapProjectData } from './BrazilMap';

const COLOR_ONLINE = '#22c55e';
const COLOR_OFFLINE = '#ef4444';
const COLOR_PARTIAL = '#eab308';

function isDarkMode() {
  return document.documentElement.classList.contains('dark');
}

function getTileUrl() {
  return isDarkMode()
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
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

export function BrazilMapModal({ open, onOpenChange, projects }: BrazilMapModalProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

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

  // Init / destroy map when dialog opens/closes
  useEffect(() => {
    if (!open) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    // Small delay so the dialog DOM is ready
    const timer = setTimeout(() => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, {
        center: [-14.2, -51.9],
        zoom: 4,
        scrollWheelZoom: true,
        zoomControl: true,
      });
      const tileLayer = L.tileLayer(getTileUrl(), {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Watch for theme changes
      const observer = new MutationObserver(() => {
        tileLayer.setUrl(getTileUrl());
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      (map as any)._themeObserver = observer;

      const layer = L.layerGroup().addTo(map);
      markers.forEach(m => {
        const dark = isDarkMode();
        const statusLabel = m.health === 'online' ? 'Operacional' : m.health === 'partial' ? 'Parcial' : 'Crítico';
        const bg = dark ? '#1e293b' : '#fff';
        const fg = dark ? '#e2e8f0' : '#111';
        const muted = dark ? '#94a3b8' : '#888';
        const popup = `<div style="font-size:12px;max-width:200px;background:${bg};color:${fg};padding:8px;border-radius:6px;">
          <p style="font-weight:600;margin:0 0 2px">${m.name}</p>
          <p style="color:${muted};margin:0 0 2px">${m.label}</p>
          <p style="margin:0"><span style="color:${m.color}">●</span> ${m.onlineDevices}/${m.totalDevices} dispositivos online</p>
          <p style="color:${muted};margin:2px 0 0">Status: ${statusLabel}</p>
        </div>`;
        L.marker([m.lat, m.lng], { icon: createShipIcon(m.color, 36) })
          .bindPopup(popup)
          .addTo(layer);
      });

      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    }, 100);

    return () => clearTimeout(timer);
  }, [open, markers]);

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
          {open && <div ref={mapRef} style={{ height: '100%', width: '100%' }} />}
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
