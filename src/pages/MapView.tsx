import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, X, Droplets, Thermometer, Wind, Battery, Zap, Activity, 
  Filter, Layers, Sprout, MapPin, SearchIcon, Eye, EyeOff, Trees, 
  Maximize2, RefreshCw, ChevronRight, Globe, Layers3, Cpu, Compass, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime } from '@/utils/formatters';
import { IoTNode, formatEYDDeviceName } from '../lib/mockData';
import { cn } from '@/lib/utils';
import api from '../lib/api';

// Map related imports
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Tooltip as LeafletTooltip } from 'react-leaflet';
import L from 'leaflet';

// Custom Marker Icons with Glowing Pulse
const createStatusIcon = (status: string, code: string) => {
  const colorMap: Record<string, { bg: string; border: string; shadow: string }> = {
    online: { bg: '#10b981', border: '#047857', shadow: 'rgba(16, 185, 129, 0.5)' },
    warning: { bg: '#f59e0b', border: '#b45309', shadow: 'rgba(245, 158, 11, 0.5)' },
    offline: { bg: '#ef4444', border: '#b91c1c', shadow: 'rgba(239, 68, 68, 0.5)' },
  };
  const theme = colorMap[status] || colorMap.offline;

  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        ${status === 'online' ? `<div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background-color: ${theme.shadow}; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
        <div style="
          position: relative;
          width: 28px; 
          height: 28px; 
          background: linear-gradient(135deg, ${theme.bg}, ${theme.border}); 
          border: 2px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 4px 12px ${theme.shadow};
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
            <rect x="9" y="9" width="6" height="6"/>
            <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
            <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
            <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/>
            <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/>
          </svg>
        </div>
      </div>
    `,
    className: 'custom-status-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

export function MapController({ center, zoom, bounds }: { center: [number, number], zoom: number, bounds?: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (center) {
      map.setView(center, zoom);
    }
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [center, zoom, bounds, map]);
  return null;
}

export default function MapView({ onViewAnalytics, landPlots: propsLandPlots, gardens: propsGardens, nodes: propNodes, readings = [] }: { 
  onViewAnalytics: (nodeId: string) => void, 
  landPlots?: any[], 
  gardens?: any[], 
  nodes?: IoTNode[],
  readings?: any[]
}) {
  const { t } = useTranslation();
  const defaultCenter: [number, number] = [-6.8315, 107.9160];
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);
  const [mapZoom, setMapZoom] = useState(13);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Layer visibility toggles
  const [showNodes, setShowNodes] = useState(true);
  const [showLands, setShowLands] = useState(true);
  const [showGardens, setShowGardens] = useState(true);
  const [tileProvider, setTileProvider] = useState<'satellite' | 'street' | 'dark'>('satellite');

  const [appNodes, setAppNodes] = useState<IoTNode[]>(propNodes || []);
  const [allLandPlots, setAllLandPlots] = useState<any[]>(propsLandPlots || []);
  const [allGardens, setAllGardens] = useState<any[]>(propsGardens || []);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);

  const [cycleIndex, setCycleIndex] = useState<{ [key: string]: number }>({
    online: 0,
    warning: 0,
    offline: 0,
    land: 0,
    garden: 0
  });
  const mapBoundsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync prop nodes
  useEffect(() => {
    if (propNodes && propNodes.length > 0) {
      setAppNodes(propNodes);
    }
  }, [propNodes]);

  // Fetch land plots and gardens polygons if not passed in props
  useEffect(() => {
    const fetchPolygons = async () => {
      const [landRes, gardenRes] = await Promise.allSettled([
        api.get('/land-plots'),
        api.get('/gardens')
      ]);

      if (landRes.status === 'fulfilled') {
        const lData = landRes.value.data?.data || landRes.value.data;
        if (Array.isArray(lData)) setAllLandPlots(lData);
      }
      if (gardenRes.status === 'fulfilled') {
        const gData = gardenRes.value.data?.data || gardenRes.value.data;
        if (Array.isArray(gData)) setAllGardens(gData);
      }
    };
    fetchPolygons();

    const handleNodesUpdated = async () => {
      try {
        const res = await api.get('/nodes');
        const list = res.data?.data || res.data;
        if (Array.isArray(list)) {
          setAppNodes(list.map(n => ({
            ...n,
            firmware_version: n.firmware_version || n.firmware || '1.0.0'
          })));
        }
      } catch (err) {
        console.error("Failed to refresh nodes on MapView", err);
      }
    };
    window.addEventListener('nodes:updated', handleNodesUpdated);

    return () => {
      window.removeEventListener('nodes:updated', handleNodesUpdated);
      if (mapBoundsTimerRef.current) clearTimeout(mapBoundsTimerRef.current);
    };
  }, []);

  // Helper: extract [lat, lng][] from polygon data
  const extractPolygonPositions = (polygon: any): [number, number][] => {
    try {
      const geom = typeof polygon === 'string' ? JSON.parse(polygon) : polygon;
      let rawCoords: any[] = [];
      if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
        rawCoords = geom.coordinates[0];
      } else if (Array.isArray(geom)) {
        rawCoords = geom;
      } else if (Array.isArray(geom.coordinates)) {
        rawCoords = geom.coordinates;
      }
      return rawCoords.map((pt: any) => {
        let lat: number, lng: number;
        if (Array.isArray(pt)) {
          if (Math.abs(pt[0]) > 90) { lng = parseFloat(pt[0]); lat = parseFloat(pt[1]); }
          else { lat = parseFloat(pt[0]); lng = parseFloat(pt[1]); }
        } else if (pt && typeof pt === 'object') {
          lat = parseFloat(pt.lat || pt.latitude);
          lng = parseFloat(pt.lng || pt.longitude);
        } else {
          return null;
        }
        return [lat, lng] as [number, number];
      }).filter((p): p is [number, number] => p !== null && !isNaN(p[0]) && !isNaN(p[1]));
    } catch {
      return [];
    }
  };

  // Resolve backend commodity name for land or garden without truncation
  const getCommodityName = (entity: any, type: 'land' | 'garden'): string => {
    if (!entity) return 'Padi & Cabai';

    if (type === 'garden') {
      const direct = entity.plant_types || entity.komoditi_name || entity.komoditi?.nama_komoditi || entity.plant?.nama_komoditi || entity.plant_name;
      if (direct && typeof direct === 'string' && direct.trim()) return direct.trim();
    }

    if (type === 'land') {
      // Find associated gardens under this land plot
      const gardens = allGardens.filter(g => g.land_plot_id === entity.id || g.lahan_id === entity.id);
      const komoditiNames = gardens
        .map(g => g.plant_types || g.komoditi_name || g.komoditi?.nama_komoditi || g.plant?.nama_komoditi || g.plant_name)
        .filter((k): k is string => Boolean(k && typeof k === 'string' && k.trim()));
      
      if (komoditiNames.length > 0) {
        return Array.from(new Set(komoditiNames)).join(', ');
      }
      if (entity.plant_types && typeof entity.plant_types === 'string') return entity.plant_types;
    }

    return 'Jagung, Cabai & Tomat';
  };

  // Clean location address helper without truncation
  const formatCleanLocation = (rawAddress?: string): string => {
    if (!rawAddress || rawAddress === '-') return 'Subang, Jawa Barat';
    const parts = rawAddress.split(',').map(s => s.trim()).filter(p => {
      const l = p.toLowerCase();
      return l !== 'indonesia' && !/^\d{5}$/.test(p);
    });
    return parts.length > 0 ? parts.join(', ') : rawAddress;
  };

  const handleCycleClick = (type: string) => {
    let items: any[] = [];
    if (type === 'online') items = appNodes.filter(n => n.status === 'online');
    else if (type === 'warning') items = appNodes.filter(n => n.status === 'warning');
    else if (type === 'offline') items = appNodes.filter(n => n.status === 'offline');
    else if (type === 'land') items = allLandPlots.filter(l => l.polygon);
    else if (type === 'garden') items = allGardens.filter(g => g.polygon);

    if (items.length === 0) return;

    const currentIndex = cycleIndex[type] || 0;
    const nextIndex = (currentIndex + 1) % items.length;
    setCycleIndex(prev => ({ ...prev, [type]: nextIndex }));

    const item = items[currentIndex];

    if (type === 'land' || type === 'garden') {
      const positions = extractPolygonPositions(item.polygon);
      if (positions.length >= 3) {
        const bounds = L.latLngBounds(positions);
        setMapBounds(null);
        if (mapBoundsTimerRef.current) clearTimeout(mapBoundsTimerRef.current);
        mapBoundsTimerRef.current = setTimeout(() => setMapBounds(bounds), 10);
      } else if (item.latitude && item.longitude) {
        setMapBounds(null);
        setMapCenter([parseFloat(item.latitude), parseFloat(item.longitude)]);
        setMapZoom(14);
      }
    } else {
      setMapBounds(null);
      setMapCenter(item.coords);
      setMapZoom(16);
    }
  };

  const resetAllBounds = () => {
    const allCoords: [number, number][] = [];
    appNodes.forEach(n => { if (n.coords) allCoords.push(n.coords); });
    allLandPlots.forEach(l => {
      const pts = extractPolygonPositions(l.polygon);
      allCoords.push(...pts);
    });
    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      setMapBounds(null);
      setTimeout(() => setMapBounds(bounds), 10);
    } else {
      setMapCenter(defaultCenter);
      setMapZoom(13);
    }
  };

  // Helper: render GeoJSON polygon on react-leaflet map with mouse hover interactive effects
  const renderGeoPolygon = (entity: any, type: 'land' | 'garden', color: string, label: string, keyPrefix: string) => {
    try {
      const polyData = entity.polygon;
      if (!polyData) return null;
      
      const positions = extractPolygonPositions(polyData);
      if (positions.length < 3) return null;

      const entityKey = `${keyPrefix}-${entity.id}-${positions.length}`;
      const komoditiText = getCommodityName(entity, type);

      return (
        <Polygon 
          key={entityKey}
          positions={positions} 
          pathOptions={{ 
            color, 
            fillColor: color, 
            fillOpacity: type === 'land' ? 0.25 : 0.35, 
            weight: type === 'land' ? 3.5 : 2.5, 
            dashArray: type === 'land' ? '6, 6' : undefined 
          }}
          eventHandlers={{
            mouseover: (e) => {
              const layer = e.target;
              layer.setStyle({
                fillOpacity: type === 'land' ? 0.45 : 0.55,
                weight: type === 'land' ? 5 : 4,
              });
            },
            mouseout: (e) => {
              const layer = e.target;
              layer.setStyle({
                fillOpacity: type === 'land' ? 0.25 : 0.35,
                weight: type === 'land' ? 3.5 : 2.5,
              });
            }
          }}
        >
          <LeafletTooltip 
            sticky 
            className={type === 'land' ? 'custom-leaflet-tooltip-land' : 'custom-leaflet-tooltip-garden'}
          >
            <div className="flex items-center gap-1.5 font-black text-xs tracking-tight">
              <span>{type === 'land' ? '🏢' : '🌳'}</span>
              <span>{label}</span>
            </div>
          </LeafletTooltip>
          <Popup className="custom-popup">
            <div className="p-4 min-w-[260px] max-w-[300px]">
              {/* Symmetrical Header */}
              <div className="flex items-center gap-3 mb-3.5 pb-3 border-b border-border/60">
                {type === 'land' ? (
                  <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs shrink-0">
                    <Building2 size={20} />
                  </div>
                ) : (
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs shrink-0">
                    <Trees size={20} />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <h3 className="font-black text-sm tracking-tight text-foreground leading-snug truncate">{label}</h3>
                  <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest mt-0.5">
                    {type === 'land' ? 'Lahan Induk (Poligon Biru)' : 'Kebun / Blok (Poligon Hijau)'}
                  </span>
                </div>
              </div>
              
              {/* Symmetrical Body Grid */}
              <div className="space-y-2.5 text-xs">
                {type === 'land' && (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
                      <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider shrink-0">Pemilik Lahan</span>
                      <span className="font-bold text-right text-foreground truncate max-w-[150px]">{entity.owner_name || entity.pemilik || 'Dinas Pertanian Subang'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-2">
                      <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider shrink-0 pt-0.5">Lokasi</span>
                      <span className="font-semibold text-right text-foreground leading-snug break-words max-w-[170px]">
                        {formatCleanLocation(entity.address || entity.location)}
                      </span>
                    </div>
                  </>
                )}
                
                {type === 'garden' && (
                  <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
                    <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider shrink-0">Lahan Induk</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 text-right truncate max-w-[150px]">{allLandPlots.find(l => l.id === entity.land_plot_id)?.plot_name || 'Lahan Subang'}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
                  <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider shrink-0">Luas Area</span>
                  <span className="font-black text-blue-600 text-right">{Number(entity.area_hectare || entity.area_ha || 2.5).toFixed(2)} Ha</span>
                </div>

                <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-2">
                  <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider shrink-0 pt-0.5">Komoditi Tanaman</span>
                  <span className="font-bold text-right text-emerald-600 dark:text-emerald-400 leading-snug break-words max-w-[150px]">{komoditiText}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider shrink-0">Tipe Tanah</span>
                  <span className="font-semibold text-right text-muted-foreground">{entity.soil_type || 'Andosol'}</span>
                </div>
              </div>
            </div>
          </Popup>
        </Polygon>
      );
    } catch { return null; }
  };

  // Combine search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    
    const nodeResults = appNodes.filter(node => 
      node.name.toLowerCase().includes(q) ||
      node.location.toLowerCase().includes(q) ||
      node.id.toLowerCase().includes(q)
    ).map(n => ({ type: 'node', label: formatEYDDeviceName(n.name, n.device_code || n.id), sub: n.location, coords: n.coords, status: n.status, id: n.id }));

    const landResults = allLandPlots.filter(l => 
      (l.plot_name || '').toLowerCase().includes(q) ||
      (l.address || '').toLowerCase().includes(q)
    ).map(l => ({ 
      type: 'land', 
      label: `Lahan: ${l.plot_name}`, 
      sub: l.address || 'Subang', 
      coords: [parseFloat(l.latitude), parseFloat(l.longitude)] as [number, number], 
      id: l.id 
    }));

    const gardenResults = allGardens.filter(g => 
      (g.garden_name || '').toLowerCase().includes(q)
    ).map(g => ({ 
      type: 'garden', 
      label: `Kebun: ${g.garden_name}`, 
      sub: `Tipe Tanah: ${g.soil_type || 'Andosol'}`, 
      coords: [parseFloat(g.latitude), parseFloat(g.longitude)] as [number, number], 
      id: g.id 
    }));

    return [...nodeResults, ...landResults, ...gardenResults];
  }, [searchQuery, appNodes, allLandPlots, allGardens]);

  const handleSelectResult = (res: any) => {
    if (res.coords && !isNaN(res.coords[0])) {
      setMapCenter(res.coords);
      setMapZoom(res.type === 'node' ? 16 : 14);
    }
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  // KPI Stats
  const onlineNodes = appNodes.filter(n => n.status === 'online').length;
  const warningNodes = appNodes.filter(n => n.status === 'warning').length;
  const offlineNodes = appNodes.filter(n => n.status === 'offline').length;
  const totalAreaHa = allLandPlots.reduce((sum, l) => sum + Number(l.area_hectare || 0), 0);

  return (
    <div className="w-full space-y-6 max-w-7xl mx-auto pb-24 select-none block">
      {/* Executive Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/60 pb-4 w-full">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs shrink-0">
            <Globe size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">{t('Peta Monitoring Node & GIS Area')}</h1>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">{t('Pemetaan spasial real-time untuk perangkat telemetry, lahan induk, dan kebun pertanian')}</p>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-full lg:w-80">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              placeholder={t("Cari Perangkat, Lahan, atau Kebun...")} 
              className="pl-10 h-11 bg-card border border-border/80 focus:bg-background rounded-2xl font-semibold text-xs transition-all shadow-xs"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>

          <AnimatePresence>
            {isSearchOpen && searchQuery && (
              <motion.div 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/80 rounded-2xl shadow-2xl z-[2000] overflow-hidden max-h-64 overflow-y-auto"
              >
                {searchResults.length > 0 ? (
                  <div className="p-2 space-y-1">
                    {searchResults.map((res, idx) => (
                      <button
                        key={`${res.type}-${res.id}-${idx}`}
                        onClick={() => handleSelectResult(res)}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/60 rounded-xl transition-colors text-left group"
                      >
                        {res.type === 'node' ? (
                          <div className={cn(
                            "w-3 h-3 rounded-full shrink-0",
                            (res as any).status === 'online' ? "bg-emerald-500 shadow-xs" : (res as any).status === 'warning' ? "bg-amber-500" : "bg-rose-500"
                          )} />
                        ) : res.type === 'land' ? (
                          <Building2 size={16} className="text-blue-500 shrink-0" />
                        ) : (
                          <Trees size={16} className="text-emerald-500 shrink-0" />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold truncate text-foreground">{res.label}</p>
                            <Badge variant="outline" className="text-[8px] px-1.5 h-4 uppercase font-black opacity-70">
                              {res.type}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate font-medium">{res.sub}</p>
                        </div>
                        <SearchIcon size={12} className="text-muted-foreground group-hover:text-emerald-600 transition-colors" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-xs font-bold text-muted-foreground">{t('Tidak ada lokasi atau node ditemukan')}</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* KPI Overview Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => resetAllBounds()}
          className="bg-card p-4 sm:p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">{t("Total Perangkat")}</span>
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{appNodes.length}</span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{onlineNodes} Aktif · {warningNodes} Alert</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <Cpu size={22} />
          </div>
        </div>

        <div 
          onClick={() => handleCycleClick('land')}
          className="bg-card p-4 sm:p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t("Lahan Induk")}</span>
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-blue-600 dark:text-blue-400">{allLandPlots.length}</span>
            <span className="text-[11px] font-semibold text-blue-700/80 dark:text-blue-400/80">{totalAreaHa > 0 ? `${totalAreaHa.toFixed(1)} Hektar` : 'Poligon Biru Terpetakan'}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform">
            <Building2 size={22} />
          </div>
        </div>

        <div 
          onClick={() => handleCycleClick('garden')}
          className="bg-card p-4 sm:p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t("Kebun / Blok")}</span>
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">{allGardens.length}</span>
            <span className="text-[11px] font-semibold text-emerald-700/80 dark:text-emerald-400/80">{t("Poligon Hijau Budidaya")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <Trees size={22} />
          </div>
        </div>

        <div 
          onClick={() => handleCycleClick('online')}
          className="bg-card p-4 sm:p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-sky-600 dark:text-sky-400 uppercase tracking-wider">{t("Koneksi Sensor")}</span>
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-sky-600 dark:text-sky-400">{readings.length}</span>
            <span className="text-[11px] font-semibold text-sky-700/80 dark:text-sky-400/80">{t("Data Live Telemetry")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 group-hover:scale-105 transition-transform">
            <Activity size={22} />
          </div>
        </div>
      </div>

      {/* Layer Control Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3.5 rounded-2xl border border-border/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1.5">
            <Layers3 size={14} className="text-emerald-500" /> Layer Peta:
          </span>

          <button
            onClick={() => setShowNodes(!showNodes)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border",
              showNodes 
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" 
                : "bg-muted/30 text-muted-foreground border-border/60"
            )}
          >
            <Cpu size={14} />
            <span>Node Perangkat ({appNodes.length})</span>
          </button>

          <button
            onClick={() => setShowLands(!showLands)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border",
              showLands 
                ? "bg-blue-500/10 text-blue-600 border-blue-500/30" 
                : "bg-muted/30 text-muted-foreground border-border/60"
            )}
          >
            <Building2 size={14} />
            <span>Lahan Induk Biru ({allLandPlots.filter(l => l.polygon).length})</span>
          </button>

          <button
            onClick={() => setShowGardens(!showGardens)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border",
              showGardens 
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" 
                : "bg-muted/30 text-muted-foreground border-border/60"
            )}
          >
            <Trees size={14} />
            <span>Kebun / Blok Hijau ({allGardens.filter(g => g.polygon).length})</span>
          </button>
        </div>

        {/* Tile Provider & Reset View */}
        <div className="flex items-center gap-2">
          <select
            value={tileProvider}
            onChange={(e: any) => setTileProvider(e.target.value)}
            className="h-9 px-3 bg-muted/30 border border-border/60 text-xs font-bold rounded-xl text-foreground outline-none cursor-pointer"
          >
            <option value="satellite" className="bg-card text-foreground">Satelit HD (Google)</option>
            <option value="street" className="bg-card text-foreground">Peta Jalan (CartoDB)</option>
            <option value="dark" className="bg-card text-foreground">Peta Gelap (Dark Mode)</option>
          </select>

          <Button 
            size="sm" 
            variant="outline" 
            className="h-9 px-3 rounded-xl font-extrabold text-xs border-border/80 hover:bg-muted cursor-pointer gap-1.5"
            onClick={resetAllBounds}
            title={t("Reset Tampilan Peta Ke Seluruh Area")}
          >
            <Maximize2 size={13} />
            <span className="hidden sm:inline">{t("Reset View")}</span>
          </Button>
        </div>
      </div>

      {/* Main Responsive GIS Map Container */}
      <div className="w-full h-[520px] sm:h-[620px] lg:h-[680px] rounded-[28px] overflow-hidden relative border border-border/80 shadow-2xl z-0 bg-card">
        <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%', background: 'transparent' }}>
          {tileProvider === 'satellite' && (
            <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="© Google Satellite" maxZoom={20} />
          )}
          {tileProvider === 'street' && (
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution="© OpenStreetMap, CARTO" maxZoom={19} />
          )}
          {tileProvider === 'dark' && (
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© CARTO Dark" maxZoom={19} />
          )}

          {/* Overlay Labels */}
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png" maxZoom={20} pane="overlayPane" />
          
          <MapController center={mapCenter} zoom={mapZoom} bounds={mapBounds} />

          {/* Floating Legend Overlay */}
          <div className="absolute bottom-6 left-6 z-[1000] flex flex-col items-start gap-2">
            {!isLegendOpen && (
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-card/90 backdrop-blur-md shadow-2xl border border-border/80 rounded-2xl font-bold text-xs cursor-pointer text-foreground"
                onClick={() => setIsLegendOpen(true)}
              >
                <Layers size={14} className="mr-2 text-emerald-500" />
                {t('Legenda Status Peta')}
              </Button>
            )}
            <AnimatePresence>
              {isLegendOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  className="bg-card/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-border/80 min-w-[210px]"
                >
                  <div className="flex items-center justify-between mb-3 border-b border-border/60 pb-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('Legenda Monitoring')}</h4>
                    <button onClick={() => setIsLegendOpen(false)} className="text-muted-foreground hover:text-foreground">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/50 p-1.5 -mx-1 rounded-xl transition-colors" onClick={() => handleCycleClick('online')}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-xs font-bold text-foreground">Node Aktif</span>
                      </div>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-black">
                        {onlineNodes}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/50 p-1.5 -mx-1 rounded-xl transition-colors" onClick={() => handleCycleClick('warning')}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        <span className="text-xs font-bold text-foreground">Peringatan</span>
                      </div>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 font-black">
                        {warningNodes}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/50 p-1.5 -mx-1 rounded-xl transition-colors" onClick={() => handleCycleClick('offline')}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                        <span className="text-xs font-bold text-foreground">Tidak Aktif</span>
                      </div>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-rose-500/10 text-rose-600 border-rose-500/20 font-black">
                        {offlineNodes}
                      </Badge>
                    </div>

                    <div className="border-t border-border/60 my-2 pt-1">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block mb-1.5">Batas Area (Poligon)</span>
                      <div className="flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/50 p-1.5 -mx-1 rounded-xl transition-colors" onClick={() => handleCycleClick('land')}>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-2.5 bg-blue-500/25 border border-blue-600 rounded-sm" style={{ borderStyle: 'dashed' }} />
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Lahan Induk (Biru)</span>
                        </div>
                        <span className="text-xs font-black text-blue-600">{allLandPlots.filter(l => l.polygon).length}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/50 p-1.5 -mx-1 rounded-xl transition-colors" onClick={() => handleCycleClick('garden')}>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-2.5 bg-emerald-500/30 border border-emerald-600 rounded-sm" />
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Kebun / Blok (Hijau)</span>
                        </div>
                        <span className="text-xs font-black text-emerald-600">{allGardens.filter(g => g.polygon).length}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Render Lahan Polygons (Royal Blue #2563EB) */}
          {showLands && allLandPlots.map(l => l.polygon && renderGeoPolygon(l, 'land', l.color || '#2563EB', `Lahan: ${l.plot_name}`, `land-${l.id}`))}

          {/* Render Kebun Polygons (Emerald Green #10B981) */}
          {showGardens && allGardens.map(g => g.polygon && renderGeoPolygon(g, 'garden', g.color || '#10B981', `Kebun: ${g.garden_name}`, `garden-${g.id}`))}

          {/* Render Node Markers */}
          {showNodes && appNodes.map((node) => {
            const eydName = formatEYDDeviceName(node.name, node.device_code || node.id);

            // Find latest telemetry reading
            const latestReading = readings.find(r =>
              r.device_id?.toString() === node.id.toString() ||
              r.device_code?.toString() === node.id.toString() ||
              r.device_db_id?.toString() === node.db_id?.toString()
            );
            
            // Find associated garden & land
            const associatedGarden = allGardens.find(g => g.id === node.gardenId || g.id === (node as any).garden_id);
            const associatedLand = allLandPlots.find(l => l.id === node.lahanId || l.id === (node as any).lahan_id);
            const plantType = node.plant_name || associatedGarden?.plant_types || associatedGarden?.komoditi?.nama_komoditi || associatedLand?.plant_types || 'Padi, Cabai & Tomat';

            return (
              <Marker 
                key={node.id} 
                position={node.coords}
                icon={createStatusIcon(node.status, node.device_code || node.id)}
                eventHandlers={{
                  click: () => {
                    setMapCenter(node.coords);
                    setMapZoom(16);
                  }
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-4 min-w-[260px] max-w-[300px]">
                    <div className="flex items-center justify-between mb-3.5 pb-3 border-b border-border/60 gap-2">
                      <div className="flex flex-col min-w-0">
                        <h3 className="font-black text-sm tracking-tight leading-snug text-foreground truncate">{eydName}</h3>
                        <span className="text-[10px] font-mono font-bold text-muted-foreground">ID: {node.device_code || node.id}</span>
                      </div>
                      <Badge 
                        variant={node.status === 'online' ? 'default' : node.status === 'warning' ? 'outline' : 'destructive'} 
                        className={cn(
                          "text-[9px] px-2 py-0.5 font-black uppercase tracking-wider rounded-lg shrink-0",
                          node.status === 'warning' && "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        )}
                      >
                        {node.status === 'online' ? 'Aktif' : node.status === 'warning' ? 'Alert' : 'Offline'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3.5">
                      <div className="bg-muted/40 p-2.5 rounded-xl flex flex-col">
                        <span className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider">Lokasi Node</span>
                        <span className="text-[11px] font-bold text-foreground break-words leading-tight">{formatCleanLocation(node.location)}</span>
                      </div>
                      <div className="bg-muted/40 p-2.5 rounded-xl flex flex-col">
                        <span className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider">Komoditi</span>
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 break-words leading-tight">{plantType}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3.5 px-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Battery size={13} className={node.battery > 20 ? "text-emerald-600" : "text-rose-600"} />
                        <span className="font-bold text-foreground">{node.battery}%</span>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          ({node.battery_voltage ? Number(node.battery_voltage).toFixed(2) : '0.00'}V)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Versi Firmware Perangkat (OTA / MQTT Payload)">
                        <Cpu size={13} className="text-indigo-500" />
                        <span className="font-bold text-foreground">
                          FW v{(() => {
                            const raw = latestReading?.firmware_version || latestReading?.firmware || latestReading?.fw_ver || latestReading?.fwVersion || (node as any).firmware_version || (node as any).firmware || '1.0.0';
                            return raw.toString().replace(/^fw\s*v?/i, '').replace(/^v/i, '');
                          })()}
                        </span>
                      </div>
                    </div>

                    {latestReading ? (
                      <>
                        <div className="grid grid-cols-2 gap-2.5 mb-3.5 border-t border-border/60 pt-3">
                          <div className="space-y-0.5">
                            <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-wider block">Suhu Udara</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-black text-amber-600">{latestReading.environment?.air_temperature_c ?? latestReading.temp ?? 0}°</span>
                              <span className="text-[9px] font-bold opacity-60">C</span>
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-wider block">Kelembapan</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-black text-blue-600">{latestReading.environment?.air_humidity_percent ?? latestReading.humidity ?? 0}%</span>
                              <span className="text-[9px] font-bold opacity-60">RH</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-border/60 flex items-center justify-between">
                          <span className="text-[9px] text-muted-foreground font-semibold italic">Update Live</span>
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="h-7 px-3 text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
                            onClick={() => onViewAnalytics(node.id)}
                          >
                            {t('Lihat Telemetri')}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground font-semibold italic">Siap Menerima Log</span>
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="h-7 px-3 text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
                          onClick={() => onViewAnalytics(node.id)}
                        >
                          {t('Lihat Detail')}
                        </Button>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
