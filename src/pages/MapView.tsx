import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, Radio, Database, CloudSun, Map as MapIcon, BarChart3, 
  FileText, Settings, Users, Bell, Search, Menu, X, Droplets, Thermometer, 
  Wind, Battery, Signal, AlertTriangle, Leaf, LogIn, LogOut, Calendar as CalendarIcon, 
  FlaskConical, Zap, Activity, Filter, Plus, Save, MoreVertical, Edit, Trash2, 
  Download, CheckCircle2, Eye, EyeOff, Trees, Layers, Sprout, MapPin, SearchIcon, Share2, Map as MapIconS
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatTime } from '@/utils/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter, ZAxis, Legend } from 'recharts';
import { IoTNode, User, UserRole } from '../lib/mockData';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import api from '../lib/api';

// Map related overrides
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Tooltip as LeafletTooltip, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import LeafletDrawMap, { PolygonDrawResult } from '../components/LeafletDrawMap';

// App specific imports

// Fix for default marker icons in Leaflet with React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Custom Marker Icons based on Status
const createStatusIcon = (status: string) => {
  const colorMap: any = {
    online: '#10b981', // emerald-500
    warning: '#eab308', // yellow-500
    offline: '#ef4444', // red-500
  };
  const color = colorMap[status] || '#ef4444';
  
  return L.divIcon({
    html: `
      <div style="
        width: 15px; 
        height: 15px; 
        background-color: ${color}; 
        border: 2px solid white; 
        border-radius: 50%; 
        box-shadow: 0 0 6px ${color};
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 4px; height: 4px; background-color: white; border-radius: 50%; opacity: 0.8;"></div>
      </div>
    `,
    className: 'custom-status-icon',
    iconSize: [15, 15],
    iconAnchor: [7.5, 7.5],
    popupAnchor: [0, -7.5],
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
    // Ensure map fits container exactly to prevent grey areas or shaking
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
  const defaultCenter: [number, number] = [-6.8315, 107.9160];
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);
  const [mapZoom, setMapZoom] = useState(14);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [appNodes, setAppNodes] = useState<IoTNode[]>(propNodes || []);
  const [allLandPlots, setAllLandPlots] = useState<any[]>([]);
  const [allGardens, setAllGardens] = useState<any[]>([]);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [cycleIndex, setCycleIndex] = useState<{ [key: string]: number }>({
    online: 0,
    warning: 0,
    offline: 0,
    land: 0,
    garden: 0
  });
  const mapBoundsTimerRef = React.useRef<NodeJS.Timeout | null>(null);

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
      // Fit bounds to the entire polygon so the full area is visible
      const positions = extractPolygonPositions(item.polygon);
      if (positions.length >= 3) {
        const bounds = L.latLngBounds(positions);
        setMapBounds(null); // force re-trigger
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

  useEffect(() => {
    if (propNodes && propNodes.length > 0) {
      setAppNodes(propNodes);
    }
  }, [propNodes]);

  useEffect(() => {
    const fetchPolygons = async () => {
      // allSettled: jika salah satu gagal, yang lain tetap tampil di peta
      // (sebelumnya Promise.all membuat polygon lahan DAN kebun sama-sama
      // kosong walau cuma satu endpoint yang error).
      const [landRes, gardenRes] = await Promise.allSettled([
        api.get('/land-plots'),
        api.get('/gardens')
      ]);

      if (landRes.status === 'fulfilled') {
        const lData = landRes.value.data?.data || landRes.value.data;
        setAllLandPlots(Array.isArray(lData) ? lData : []);
      } else {
        console.error("Failed to fetch land plots for map", landRes.reason);
      }

      if (gardenRes.status === 'fulfilled') {
        const gData = gardenRes.value.data?.data || gardenRes.value.data;
        setAllGardens(Array.isArray(gData) ? gData : []);
      } else {
        console.error("Failed to fetch gardens for map", gardenRes.reason);
      }
    };
    fetchPolygons();

    // Phase 1 Cleanup: Clear pending bounds timer on unmount
    return () => {
      if (mapBoundsTimerRef.current) clearTimeout(mapBoundsTimerRef.current);
    };
  }, []);

  // Helper: render GeoJSON polygon on react-leaflet map
  const renderGeoPolygon = (entity: any, type: 'land' | 'garden', color: string, label: string, keyPrefix: string) => {
    try {
      const polyData = entity.polygon;
      if (!polyData) return null;
      
      const geom = typeof polyData === 'string' ? JSON.parse(polyData) : polyData;
      
      // Extract coordinates regardless of GeoJSON structure or simple list
      let rawCoords = [];
      if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
        rawCoords = geom.coordinates[0];
      } else if (Array.isArray(geom)) {
        rawCoords = geom;
      } else if (Array.isArray(geom.coordinates)) {
        rawCoords = geom.coordinates;
      }

      if (!Array.isArray(rawCoords) || rawCoords.length < 3) return null;
      
      // Convert to [lat, lng] for Leaflet
      const positions = rawCoords.map((pt: any) => {
        let lat, lng;
        if (Array.isArray(pt)) {
          // Handle [lng, lat] (standard GeoJSON) vs [lat, lng]
          // Heuristic for Indonesia: Lat is around -6 to -8, Lng is around 106 to 115
          if (Math.abs(pt[0]) > 90) { 
            lng = parseFloat(pt[0]);
            lat = parseFloat(pt[1]);
          } else {
            lat = parseFloat(pt[0]);
            lng = parseFloat(pt[1]);
          }
        } else if (pt && typeof pt === 'object') {
          lat = parseFloat(pt.lat || pt.latitude);
          lng = parseFloat(pt.lng || pt.longitude);
        }
        return [lat, lng] as [number, number];
      }).filter(pos => !isNaN(pos[0]) && !isNaN(pos[1]));

      if (positions.length < 3) return null;

      const entityKey = `${keyPrefix}-${entity.id}-${positions.length}`;
      
      return (
        <Polygon 
          key={entityKey}
          positions={positions} 
          pathOptions={{ 
            color, 
            fillColor: color, 
            fillOpacity: type === 'land' ? 0.35 : 0.3, 
            weight: type === 'land' ? 5 : 3, 
            dashArray: type === 'land' ? '10, 5' : undefined 
          }}
        >
          <LeafletTooltip sticky className="font-bold text-[10px] uppercase tracking-tighter">{label}</LeafletTooltip>
          <Popup>
            <div className="p-3 min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                {type === 'land' ? <MapIcon size={16} className="text-blue-500" /> : <Trees size={16} className="text-emerald-500" />}
                <h3 className="font-black text-sm tracking-tight">{label}</h3>
              </div>
              
              <div className="space-y-2 text-[11px]">
                {type === 'land' && (
                  <>
                    <div className="flex justify-between border-b border-border/50 pb-1">
                      <span className="text-muted-foreground font-bold uppercase text-[9px]">Pemilik</span>
                      <span className="font-medium text-right">{entity.owner_name || '-'}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-1">
                      <span className="text-muted-foreground font-bold uppercase text-[9px]">Alamat</span>
                      <span className="font-medium text-right">{(() => {
                        const addr = entity.address || '-';
                        if (addr === '-') return addr;
                        return addr.split(',').map((s: string) => s.trim()).filter((p: string) => {
                          const l = p.toLowerCase();
                          return l !== 'jawa' && l !== 'indonesia' && !/^\d{5}$/.test(p);
                        }).join(', ');
                      })()}</span>
                    </div>
                  </>
                )}
                
                {type === 'garden' && (
                  <div className="flex justify-between border-b border-border/50 pb-1">
                    <span className="text-muted-foreground font-bold uppercase text-[9px]">Lahan Induk</span>
                    <span className="font-medium text-blue-600 font-bold text-right">{allLandPlots.find(l => l.id === entity.land_plot_id)?.plot_name || 'AgriSense Area'}</span>
                  </div>
                )}

                <div className="flex justify-between border-b border-border/50 pb-1">
                  <span className="text-muted-foreground font-bold uppercase text-[9px]">Luas Hektar</span>
                  <span className="font-black text-primary text-right">{Number(entity.area_hectare || 0).toFixed(3)} Ha</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-1">
                  <span className="text-muted-foreground font-bold uppercase text-[9px]">Jenis Tanaman</span>
                  <span className="font-medium text-right">{entity.plant_types || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-bold uppercase text-[9px]">Tipe Tanah</span>
                  <span className="font-medium text-right">{entity.soil_type || '-'}</span>
                </div>
              </div>
            </div>
          </Popup>
        </Polygon>
      );
    } catch { return null; }
  };

  // Search Results Combine (Nodes + Land + Garden)
  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    
    const nodeResults = appNodes.filter(node => 
      node.name.toLowerCase().includes(q) ||
      node.location.toLowerCase().includes(q) ||
      node.id.toLowerCase().includes(q)
    ).map(n => ({ type: 'node', label: n.name, sub: n.location, coords: n.coords, status: n.status, id: n.id }));

    const landResults = allLandPlots.filter(l => 
      (l.plot_name || '').toLowerCase().includes(q) ||
      (l.address || '').toLowerCase().includes(q)
    ).map(l => ({ 
      type: 'land', 
      label: l.plot_name, 
      sub: l.address, 
      coords: [parseFloat(l.latitude), parseFloat(l.longitude)] as [number, number], 
      id: l.id 
    }));

    const gardenResults = allGardens.filter(g => 
      (g.garden_name || '').toLowerCase().includes(q)
    ).map(g => ({ 
      type: 'garden', 
      label: g.garden_name, 
      sub: `Tipe: ${g.soil_type}`, 
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Peta Lokasi Node</h1>

        <div className="relative w-full md:w-80">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input 
              placeholder="Cari Node, Lahan, atau Kebun..." 
              className="pl-10 h-11 bg-card border-none shadow-lg shadow-black/5 rounded-xl font-medium"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
            />
          </div>

          <AnimatePresence>
            {isSearchOpen && searchQuery && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl z-[1100] overflow-hidden max-h-64 overflow-y-auto"
              >
                {searchResults.length > 0 ? (
                  <div className="p-2 space-y-1">
                    {searchResults.map((res, idx) => (
                      <button
                        key={`${res.type}-${res.id}-${idx}`}
                        onClick={() => handleSelectResult(res)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted rounded-lg transition-colors text-left group"
                      >
                        {res.type === 'node' ? (
                           <div className={cn(
                            "w-2.5 h-2.5 rounded-full shrink-0",
                            (res as any).status === 'online' ? "bg-emerald-500" : (res as any).status === 'warning' ? "bg-yellow-500" : "bg-destructive"
                          )} />
                        ) : res.type === 'land' ? (
                          <MapIconS size={16} className="text-blue-500 shrink-0" />
                        ) : (
                          <Trees size={16} className="text-emerald-500 shrink-0" />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold truncate">{res.label}</p>
                            <Badge variant="outline" className="text-[8px] px-1 h-3.5 uppercase font-black opacity-50">
                              {res.type}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{res.sub}</p>
                        </div>
                        <SearchIcon size={12} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">Tidak ada hasil ditemukan</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="h-[600px] w-full rounded-2xl overflow-hidden relative z-0 shadow-2xl shadow-black/10">
        <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%', background: 'transparent' }}>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Satelit">
              <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="© Google" maxZoom={20} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Peta Jalan (OSM)">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/attributions'>CARTO</a>" maxZoom={19} />
            </LayersControl.BaseLayer>
          </LayersControl>
          {/* Overlay label transparan: nama daerah, jalan, sungai — teks tegas tanpa ikon POI */}
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png" maxZoom={20} pane="overlayPane" />
          
          <MapController center={mapCenter} zoom={mapZoom} bounds={mapBounds} />

          {/* Legend Overlay */}
          <div className="absolute bottom-6 left-6 z-[1000] flex flex-col items-start gap-2">
            {!isLegendOpen && (
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-background/90 backdrop-blur-md shadow-xl rounded-xl font-bold text-xs"
                onClick={() => setIsLegendOpen(true)}
              >
                <Layers size={14} className="mr-2" />
                Buka Legenda
              </Button>
            )}
            <AnimatePresence>
              {isLegendOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  className="bg-background/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-border/50 min-w-[200px]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80">Legenda Status</h4>
                    <button onClick={() => setIsLegendOpen(false)} className="text-muted-foreground hover:text-foreground">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/50 p-1 -mx-1 rounded-md transition-colors" onClick={() => handleCycleClick('online')}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-xs font-bold">Aktif</span>
                </div>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-black">
                  {appNodes.filter(n => n.status === 'online').length}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/50 p-1 -mx-1 rounded-md transition-colors" onClick={() => handleCycleClick('warning')}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                  <span className="text-xs font-bold">Peringatan</span>
                </div>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20 font-black">
                  {appNodes.filter(n => n.status === 'warning').length}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/50 p-1 -mx-1 rounded-md transition-colors" onClick={() => handleCycleClick('offline')}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                  <span className="text-xs font-bold">Tidak Aktif</span>
                </div>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-destructive/10 text-destructive font-black">
                  {appNodes.filter(n => n.status === 'offline').length}
                </Badge>
              </div>

              <div className="border-t border-border/50 my-2" />
              <div className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-1 -mx-1 rounded-md transition-colors" onClick={() => handleCycleClick('land')}>
                <div className="w-4 h-2 bg-blue-500/20 border border-blue-500 rounded-sm" style={{ borderStyle: 'dashed' }} />
                <span className="text-xs font-bold">Lahan ({allLandPlots.filter(l => l.polygon).length})</span>
              </div>
              <div className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-1 -mx-1 rounded-md transition-colors" onClick={() => handleCycleClick('garden')}>
                <div className="w-4 h-2 bg-emerald-500/20 border border-emerald-600 rounded-sm" />
                <span className="text-xs font-bold">Kebun ({allGardens.filter(g => g.polygon).length})</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase tracking-tighter">
                <Activity size={12} />
                <span>Total Perangkat</span>
              </div>
                  <span className="text-xs font-black">{appNodes.length}</span>
                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>

          {/* Render Lahan Polygons (orange/custom) */}
          {allLandPlots.map(l => l.polygon && renderGeoPolygon(l, 'land', l.color || '#F59E0B', `Lahan: ${l.plot_name}`, `land-${l.id}`))}

          {/* Render Kebun Polygons (emerald/custom) */}
          {allGardens.map(g => g.polygon && renderGeoPolygon(g, 'garden', g.color || '#22C55E', `Kebun: ${g.garden_name}`, `garden-${g.id}`))}

          {appNodes.map((node) => {
            // Find latest reading for this node (from real-time props)
            const latestReading = readings.find(r =>
              r.device_id?.toString() === node.id.toString() ||
              r.device_code?.toString() === node.id.toString()
            );
            
            // Find associated garden/land for plant type info
            const associatedGarden = allGardens.find(g => g.id.toString() === node.gardenId);
            const associatedLand = allLandPlots.find(l => l.id.toString() === node.lahanId);
            const plantType = associatedGarden?.plant_types || associatedLand?.plant_types || 'Tidak diketahui';

            return (
              <Marker 
                key={node.id} 
                position={node.coords}
                icon={createStatusIcon(node.status)}
                eventHandlers={{
                  click: () => {
                    setMapCenter(node.coords);
                    setMapZoom(15);
                  }
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-3 min-w-[220px]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex flex-col">
                        <h3 className="font-black text-sm tracking-tight leading-none mb-1">{node.name}</h3>
                        <span className="text-[9px] font-mono text-muted-foreground">{node.id}</span>
                      </div>
                      <Badge 
                        variant={node.status === 'online' ? 'default' : node.status === 'warning' ? 'outline' : 'destructive'} 
                        className={cn(
                          "text-[9px] px-2 py-0 font-black uppercase tracking-tighter",
                          node.status === 'warning' && "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                        )}
                      >
                        {node.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-muted/30 p-2 rounded-lg flex flex-col">
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Lokasi</span>
                        <span className="text-[10px] font-bold truncate">{node.location}</span>
                      </div>
                      <div className="bg-muted/30 p-2 rounded-lg flex flex-col">
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Tanaman</span>
                        <span className="text-[10px] font-bold truncate text-emerald-600">{plantType}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4 px-1">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-3 h-3 rounded-sm flex items-center justify-center",
                          node.battery > 20 ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
                        )}>
                          <Battery size={10} />
                        </div>
                        <span className="text-[10px] font-black">{node.battery}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-blue-500/10 text-blue-600 flex items-center justify-center">
                          <Zap size={10} />
                        </div>
                        <span className="text-[10px] font-black">v{(node as any).firmware || '1.0.0'}</span>
                      </div>
                    </div>

                    {latestReading ? (
                      <>
                        <div className="grid grid-cols-2 gap-3 mb-4 border-t border-border/50 pt-3">
                          <div className="space-y-1">
                            <span className="text-[8px] uppercase font-bold text-muted-foreground/60 tracking-widest">Level CO₂</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-black text-primary">{latestReading.carbon_data.co2_ppm.toFixed(1)}</span>
                              <span className="text-[8px] font-bold opacity-50">ppm</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] uppercase font-bold text-muted-foreground/60 tracking-widest">Lembap Tanah</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-black text-blue-600">N/A</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-border flex items-center justify-between">
                          <span className="text-[8px] text-muted-foreground font-medium italic">Update: {formatTime(latestReading.timestamp)} WIB</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-[9px] font-bold text-primary hover:bg-primary/5"
                            onClick={() => onViewAnalytics(node.id)}
                          >
                            Buka Detail
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="py-2 text-center border-t border-border/50 pt-3">
                        <p className="text-[10px] text-muted-foreground font-bold italic">Offline / Menunggu Data</p>
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
