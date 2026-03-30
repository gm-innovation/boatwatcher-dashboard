import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { BRAZIL_STATES, SVG_VIEWBOX } from './brazilStatesData';
import { findCityCoords, SVG_WIDTH, SVG_HEIGHT, type MapProjectData } from './BrazilMap';
import { spreadOverlappingMarkers } from './mapUtils';

const COLOR_ONLINE = '#22c55e';
const COLOR_OFFLINE = '#ef4444';

const SHIP_PATH = 'M-10,4 C-10,6 10,6 10,4 L8,-1 L6,-1 L6,-5 L2,-5 L2,-1 L-6,-1 L-8,0 Z';
const COLOR_PARTIAL = '#eab308';

const MIN_SCALE = 0.8;
const MAX_SCALE = 6;
const ZOOM_STEP = 0.3;

interface BrazilMapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: MapProjectData[];
}

export function BrazilMapModal({ open, onOpenChange, projects }: BrazilMapModalProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (open) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [open]);

  const spreadDist = Math.max(15, 20 / Math.sqrt(scale));

  const markers = (() => {
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
    return spreadOverlappingMarkers(raw, spreadDist);
  })();

  const vbWidth = SVG_WIDTH / scale;
  const vbHeight = SVG_HEIGHT / scale;
  const vbX = -5 + (SVG_WIDTH - vbWidth) / 2 + translate.x;
  const vbY = -5 + (SVG_HEIGHT - vbHeight) / 2 + translate.y;
  const viewBox = `${vbX} ${vbY} ${vbWidth} ${vbHeight}`;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale(s => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStart.current.x) / scale * -1;
    const dy = (e.clientY - dragStart.current.y) / scale * -1;
    setTranslate({ x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
  }, [isDragging, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const zoomIn = () => setScale(s => Math.min(MAX_SCALE, s + ZOOM_STEP));
  const zoomOut = () => setScale(s => Math.max(MIN_SCALE, s - ZOOM_STEP));
  const resetView = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

  const compensatedRadius = (r: number) => Math.max(3, r / Math.sqrt(scale));
  const compensatedStroke = 2 / Math.sqrt(scale);
  const compensatedFontSize = 10 / Math.sqrt(scale);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">Mapa de Operações</DialogTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={zoomOut} title="Diminuir zoom">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[40px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={zoomIn} title="Aumentar zoom">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 ml-1" onClick={resetView} title="Resetar vista">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Use scroll para zoom e arraste para navegar · {markers.length} projeto(s) no mapa
          </p>
        </DialogHeader>
        
        <div
          className="flex-1 min-h-0 overflow-hidden bg-muted/20"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <TooltipProvider delayDuration={0}>
            <svg
              ref={svgRef}
              viewBox={viewBox}
              className="w-full h-full"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ userSelect: 'none' }}
              aria-label="Mapa do Brasil expandido com zoom"
            >
              {/* Brazil states */}
              {Object.entries(BRAZIL_STATES).map(([abbr, d]) => (
                <path
                  key={abbr}
                  d={d}
                  fill="hsl(var(--muted))"
                  stroke="hsl(var(--border))"
                  strokeWidth={1 / Math.sqrt(scale)}
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
                  strokeWidth={0.8 / Math.sqrt(scale)}
                  opacity={0.25}
                  strokeDasharray={`${3 / Math.sqrt(scale)},${2 / Math.sqrt(scale)}`}
                />
              ))}

              {/* Markers */}
              {markers.map((m) => {
                const cr = compensatedRadius(m.radius);
                return (
                  <Tooltip key={m.id}>
                    <TooltipTrigger asChild>
                      <g style={{ cursor: 'pointer' }}>
                        <circle cx={m.x} cy={m.y} r={cr + 2} fill={m.color} opacity={0.3}>
                          <animate attributeName="r" from={String(cr)} to={String(cr + 10 / Math.sqrt(scale))} dur="2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
                        </circle>
                        <path
                          d={SHIP_PATH}
                          transform={`translate(${m.x},${m.y}) scale(${cr / 8})`}
                          fill={m.color}
                          stroke="hsl(var(--background))"
                          strokeWidth={compensatedStroke / (cr / 8)}
                        />
                        <text
                          x={m.x + cr + 3 / Math.sqrt(scale)}
                          y={m.y + compensatedFontSize / 3}
                          fontSize={compensatedFontSize}
                          fill="hsl(var(--foreground))"
                          fontWeight="500"
                          opacity={0.85}
                        >
                          {m.name}
                        </text>
                      </g>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-[200px]">
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-muted-foreground">{m.label}</p>
                      <p>
                        <span style={{ color: m.color }}>●</span>{' '}
                        {m.onlineDevices}/{m.totalDevices} dispositivos online
                      </p>
                      <p className="text-muted-foreground">
                        Status: {m.health === 'online' ? 'Operacional' : m.health === 'partial' ? 'Parcial' : 'Crítico'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </svg>
          </TooltipProvider>
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
