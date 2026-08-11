import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Layers, Plus, Map as MapIcon, Edit, Trash2, Search, Trees, Sprout, Database, Save, X, ChevronLeft, ChevronRight, MapPin, TrendingUp, Globe, Radio, Maximize2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockLandPlots, mockGardens, LandPlot, Garden } from '../lib/mockData';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import LeafletDrawMap, { PolygonDrawResult } from '../components/LeafletDrawMap';
import { MapContainer, TileLayer, Polygon, Tooltip as LeafletTooltip, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '@/lib/utils';
import api from '../lib/api';
import { generateUniqueCode } from '../utils/generators';
import { cleanAddress, reverseGeocode } from '../utils/geolocation';
import AreaFormModal from '../components/area/AreaFormModal';

// Custom Map Zoom & Layer Controller
const MapZoomController = ({
  onFitAll,
  mapType,
  setMapType,
}: {
  onFitAll: () => void;
  mapType: 'satelit' | 'jalan';
  setMapType: (t: 'satelit' | 'jalan') => void;
}) => {
  const { t } = useTranslation();
  const map = useMap();

  return (
    <div className="absolute top-4 left-4 z-[400] flex flex-wrap items-center gap-2">
      {/* Zoom Controls */}
      <div className="flex items-center bg-card/90 backdrop-blur-md border border-border/80 rounded-2xl shadow-xl p-1 gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => map.zoomIn()}
          className="h-9 w-9 rounded-xl font-black text-sm hover:bg-muted cursor-pointer"
          title={t("Zoom In")}
        >
          +
        </Button>
        <div className="h-4 w-px bg-border/60" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => map.zoomOut()}
          className="h-9 w-9 rounded-xl font-black text-sm hover:bg-muted cursor-pointer"
          title={t("Zoom Out")}
        >
          -
        </Button>
      </div>

      {/* Fit Bounds Button */}
      <Button
        type="button"
        variant="outline"
        onClick={onFitAll}
        className="h-11 px-4 rounded-2xl bg-card/90 hover:bg-card border border-border/80 backdrop-blur-md font-extrabold text-xs text-foreground shadow-xl cursor-pointer gap-2 transition-all"
        title={t("Reset Tampilan Peta")}
      >
        <Maximize2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="hidden sm:inline">{t("Fit Bounds")}</span>
      </Button>

      {/* Layer Switcher (Satelit / Jalan) */}
      <div className="flex items-center bg-card/90 backdrop-blur-md border border-border/80 rounded-2xl p-1 gap-1 shadow-xl">
        <button
          type="button"
          onClick={() => setMapType('satelit')}
          className={cn(
            "px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer",
            mapType === 'satelit'
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("Satelit")}
        </button>
        <button
          type="button"
          onClick={() => setMapType('jalan')}
          className={cn(
            "px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer",
            mapType === 'jalan'
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("Peta Jalan")}
        </button>
      </div>
    </div>
  );
};

// Interactive GeoJSON Polygon Component with hover effects
const InteractivePolygon = React.memo(({
  item,
  type,
  color,
  parentLandName,
  gardenCount,
}: {
  item: any;
  type: 'lahan' | 'kebun';
  color: string;
  parentLandName?: string;
  gardenCount?: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const positions = useMemo(() => {
    try {
      const geom = typeof item.polygon === 'string' ? JSON.parse(item.polygon) : item.polygon;
      if (!geom?.coordinates?.[0]) return null;
      return geom.coordinates[0].map((c: number[]) => [c[1], c[0]] as [number, number]);
    } catch {
      return null;
    }
  }, [item.polygon]);

  if (!positions) return null;

  const isLahan = type === 'lahan';
  const strokeColor = color || (isLahan ? '#3B82F6' : '#10B981');
  const name = isLahan ? item.plot_name : item.garden_name;
  const code = isLahan ? item.plot_code : item.garden_code;

  return (
    <Polygon
      positions={positions}
      pathOptions={{
        color: strokeColor,
        fillColor: strokeColor,
        fillOpacity: isHovered ? (isLahan ? 0.35 : 0.45) : (isLahan ? 0.15 : 0.22),
        weight: isHovered ? 3.5 : 2,
        dashArray: isHovered ? '' : isLahan ? '' : '4, 4',
      }}
      eventHandlers={{
        mouseover: () => setIsHovered(true),
        mouseout: () => setIsHovered(false),
      }}
    >
      <LeafletTooltip sticky opacity={1} direction="top" offset={[0, -10]} className="clean-map-tooltip">
        <div className="p-3 bg-card/95 backdrop-blur-md rounded-2xl border border-border/80 shadow-2xl space-y-2 min-w-[260px] text-foreground">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1",
              isLahan ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
            )}>
              {isLahan ? <MapPin size={10} /> : <Trees size={10} />}
              {isLahan ? 'Lahan Induk' : 'Kebun / Blok'}
            </span>
            <span className="font-mono text-[10px] font-bold text-muted-foreground">{code}</span>
          </div>

          <div>
            <h4 className="font-black text-sm text-foreground tracking-tight">{name}</h4>
            {isLahan && item.owner_name && (
              <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">Pemilik: {item.owner_name}</p>
            )}
            {!isLahan && parentLandName && (
              <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">Lahan: {parentLandName}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-[11px]">
            <div className="bg-muted/40 p-1.5 rounded-xl text-center">
              <span className="text-[9px] font-extrabold text-muted-foreground uppercase block">Luas Area</span>
              <span className="font-black text-foreground">{Number(item.area_hectare || 0).toFixed(2)} Ha</span>
            </div>
            {isLahan ? (
              <div className="bg-muted/40 p-1.5 rounded-xl text-center">
                <span className="text-[9px] font-extrabold text-muted-foreground uppercase block">Jumlah Kebun</span>
                <span className="font-black text-foreground">{gardenCount || 0} Blok</span>
              </div>
            ) : (
              <div className="bg-muted/40 p-1.5 rounded-xl text-center">
                <span className="text-[9px] font-extrabold text-muted-foreground uppercase block">Tipe Tanah</span>
                <span className="font-bold text-foreground text-[10px] leading-tight block whitespace-normal">{item.soil_type || '-'}</span>
              </div>
            )}
          </div>
        </div>
      </LeafletTooltip>
    </Polygon>
  );
});

// Overview map component with floating search, hover cards & legend
const OverviewMap = React.memo(({ landPlots, gardens }: { landPlots: any[], gardens: any[] }) => {
  const { t } = useTranslation();
  const mapRef = useRef<L.Map | null>(null);
  const [mapSearch, setMapSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mapType, setMapType] = useState<'satelit' | 'jalan'>('satelit');

  // Fit bounds helper
  const handleFitAll = () => {
    if (!mapRef.current) return;
    const points: L.LatLngExpression[] = [];
    landPlots.forEach(l => {
      if (l.latitude && l.longitude) points.push([l.latitude, l.longitude]);
    });
    gardens.forEach(g => {
      if (g.latitude && g.longitude) points.push([g.latitude, g.longitude]);
    });
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  };

  useEffect(() => {
    handleFitAll();
  }, [landPlots, gardens]);

  // Combined search list
  const searchResults = useMemo(() => {
    if (!mapSearch.trim()) return [];
    const q = mapSearch.toLowerCase();
    const lands = landPlots.filter(l => (l.plot_name || '').toLowerCase().includes(q) || (l.plot_code || '').toLowerCase().includes(q)).map(l => ({ ...l, type: 'lahan' as const }));
    const kbns = gardens.filter(g => (g.garden_name || '').toLowerCase().includes(q) || (g.garden_code || '').toLowerCase().includes(q)).map(g => ({ ...g, type: 'kebun' as const }));
    return [...lands, ...kbns];
  }, [mapSearch, landPlots, gardens]);

  const handleSelectResult = (item: any) => {
    setMapSearch(item.type === 'lahan' ? item.plot_name : item.garden_name);
    setIsSearchOpen(false);
    if (!mapRef.current) return;

    if (item.latitude && item.longitude) {
      mapRef.current.flyTo([item.latitude, item.longitude], 16, { duration: 1.5 });
    } else if (item.polygon) {
      try {
        const geom = typeof item.polygon === 'string' ? JSON.parse(item.polygon) : item.polygon;
        if (geom?.coordinates?.[0]?.length) {
          const positions = geom.coordinates[0].map((c: number[]) => [c[1], c[0]] as [number, number]);
          const bounds = L.latLngBounds(positions);
          mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const totalArea = useMemo(() => {
    return landPlots.reduce((sum, l) => sum + Number(l.area_hectare || 0), 0).toFixed(1);
  }, [landPlots]);

  return (
    <div className="border border-border/80 shadow-2xl shadow-black/5 rounded-[28px] overflow-hidden relative bg-card">
      {/* Floating Map Search Bar */}
      <div className="absolute top-4 right-4 z-[1000] w-72 sm:w-80 pointer-events-auto">
        <div className="relative">
          <div className="flex items-center bg-card/90 backdrop-blur-md border border-border/80 rounded-2xl shadow-xl px-3.5 h-11 focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all">
            <Search size={16} className="text-muted-foreground shrink-0 mr-2.5" />
            <input
              type="text"
              placeholder={t("Cari Lahan atau Kebun di peta...")}
              className="w-full bg-transparent text-xs font-semibold text-foreground placeholder:text-muted-foreground outline-none"
              value={mapSearch}
              onChange={(e) => {
                setMapSearch(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
            />
            {mapSearch && (
              <button
                type="button"
                onClick={() => { setMapSearch(''); setIsSearchOpen(false); }}
                className="p-1 hover:bg-muted rounded-full text-muted-foreground cursor-pointer shrink-0"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-[450] divide-y divide-border/40">
              {searchResults.map((item: any) => {
                const isLahan = item.type === 'lahan';
                const title = isLahan ? item.plot_name : item.garden_name;
                const code = isLahan ? item.plot_code : item.garden_code;
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="p-3 hover:bg-emerald-500/10 cursor-pointer transition-colors flex items-center justify-between"
                    onClick={() => handleSelectResult(item)}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={cn(
                        "p-1.5 rounded-lg shrink-0",
                        isLahan ? "bg-blue-500/10 text-blue-600" : "bg-emerald-500/10 text-emerald-600"
                      )}>
                        {isLahan ? <MapPin size={14} /> : <Trees size={14} />}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-foreground">{title}</p>
                        <p className="text-[10px] font-semibold text-muted-foreground">{isLahan ? 'Lahan Induk' : 'Kebun / Blok'} • {code}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {Number(item.area_hectare || 0).toFixed(1)} Ha
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Leaflet Map Box */}
      <div className="h-[400px] w-full relative overflow-hidden rounded-t-[27px]">
        <MapContainer
          ref={mapRef}
          center={[-6.8396, 107.9224]}
          zoom={11}
          zoomControl={false}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <MapZoomController onFitAll={handleFitAll} mapType={mapType} setMapType={setMapType} />

          {mapType === 'satelit' ? (
            <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="© Google" maxZoom={20} />
          ) : (
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap" maxZoom={19} />
          )}

          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png" maxZoom={20} pane="overlayPane" />

          {/* Render Lahan Polygons */}
          {landPlots.map(l => {
            if (!l.polygon) return null;
            const gCount = gardens.filter(g => g.land_plot_id === l.id).length;
            return (
              <InteractivePolygon
                key={`land-${l.id}`}
                item={l}
                type="lahan"
                color={l.color}
                gardenCount={gCount}
              />
            );
          })}

          {/* Render Kebun Polygons */}
          {gardens.map(g => {
            if (!g.polygon) return null;
            const parent = landPlots.find(l => l.id === g.land_plot_id);
            return (
              <InteractivePolygon
                key={`garden-${g.id}`}
                item={g}
                type="kebun"
                color={g.color}
                parentLandName={parent?.plot_name}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* Integrated Full-Width Footer Bar (100% Symmetrical, Zero Unused Space) */}
      <div className="px-6 py-3.5 bg-card border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold rounded-b-[27px]">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-blue-500/20 border-2 border-blue-500 inline-block rounded-md shadow-xs" />
            <span className="text-foreground">{t("Lahan Induk")}</span>
            <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5">{landPlots.length}</Badge>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-emerald-500/20 border-2 border-emerald-500 inline-block rounded-md shadow-xs" />
            <span className="text-foreground">{t("Kebun / Blok")}</span>
            <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5">{gardens.length}</Badge>
          </span>
        </div>

        <div className="flex items-center gap-6 text-muted-foreground text-xs font-semibold">
          <span>{t("Total Luas GIS")}: <span className="text-foreground font-black text-sm ml-1">{totalArea} Ha</span></span>
          <div className="h-4 w-px bg-border/60 hidden sm:block" />
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
            <Sparkles size={14} /> {t("Peta GIS Interaktif")}
          </span>
        </div>
      </div>
    </div>
  );
});

// ============================================================
// Component: AreaManagementView
// Manages Land Plots and Gardens with GIS polygon drawing.
// Layout: Map LEFT | Form RIGHT (matching web-iot-carbon style)
// Fields: Aligned with Laravel migrations
// ============================================================

const AreaManagementView = React.memo(({ userRole }: { userRole?: string }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'lahan' | 'kebun' | 'tanaman'>('lahan');
  const [landPlots, setLandPlots] = useState<any[]>([]);
  const [gardens, setGardens] = useState<any[]>([]);
  const [plantings, setPlantings] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [komoditiList, setKomoditiList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageLand, setPageLand] = useState(1);
  const [pageGarden, setPageGarden] = useState(1);
  const [pagePlanting, setPagePlanting] = useState(1);
  const PER_PAGE = 10;
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(komoditiList.map(k => k.kategori_tanaman)));
  }, [komoditiList]);

  const filteredKomoditi = useMemo(() => {
    return komoditiList.filter(k => k.kategori_tanaman === selectedCategory && k.status === 'Aktif');
  }, [komoditiList, selectedCategory]);

  // Dialog state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'lahan' | 'kebun' | 'tanaman'; id: number } | null>(null);

  // Editing state
  const [editingLand, setEditingLand] = useState<LandPlot | null>(null);
  const [editingGarden, setEditingGarden] = useState<Garden | null>(null);
  const [editingPlanting, setEditingPlanting] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Fetch Data ──
  const fetchData = async () => {
    // allSettled (bukan Promise.all): satu endpoint gagal tidak lagi mengosongkan
    // SELURUH halaman — sebelumnya Promise.all menolak semua data begitu satu
    // request gagal, jadi lahan/kebun/tanaman/komoditi/node yang sudah sukses
    // di-fetch pun ikut tidak tampil, tanpa keterangan apa pun ke user.
    const [landRes, gardenRes, plantingRes, komoditiRes, nodesRes] = await Promise.allSettled([
      api.get('/land-plots'),
      api.get('/gardens'),
      api.get('/plantings'),
      api.get('/komoditi'),
      api.get('/nodes')
    ]);

    let hadForbidden = false;
    [landRes, gardenRes, plantingRes, komoditiRes, nodesRes].forEach((r) => {
      if (r.status === 'rejected') {
        const err: any = r.reason;
        console.error('SERVER ERROR FETCH AREAS:', err?.response?.status, err?.response?.data);
        if (err?.response?.status === 403) hadForbidden = true;
      }
    });
    if (hadForbidden) {
      toast.error("Akses Ditolak: Anda tidak memiliki izin role untuk melihat sebagian data.");
    }

    // Transform Land Plots
    if (landRes.status === 'fulfilled') {
      const rawLand = Array.isArray(landRes.value.data) ? landRes.value.data : landRes.value.data?.data;
      if (Array.isArray(rawLand)) setLandPlots(rawLand);
    }

    // Transform Gardens
    if (gardenRes.status === 'fulfilled') {
      const rawGardens = Array.isArray(gardenRes.value.data) ? gardenRes.value.data : gardenRes.value.data?.data;
      if (Array.isArray(rawGardens)) setGardens(rawGardens);
    }

    // Transform Plantings
    if (plantingRes.status === 'fulfilled') {
      const rawPlantings = Array.isArray(plantingRes.value.data) ? plantingRes.value.data : plantingRes.value.data?.data;
      if (Array.isArray(rawPlantings)) setPlantings(rawPlantings);
    }

    // Transform Komoditi
    if (komoditiRes.status === 'fulfilled') {
      const rawKomoditi = Array.isArray(komoditiRes.value.data) ? komoditiRes.value.data : komoditiRes.value.data?.data;
      if (Array.isArray(rawKomoditi)) setKomoditiList(rawKomoditi);
    }

    // Transform Nodes
    if (nodesRes.status === 'fulfilled') {
      const rawNodes = Array.isArray(nodesRes.value.data) ? nodesRes.value.data : nodesRes.value.data?.data;
      if (Array.isArray(rawNodes)) setNodes(rawNodes);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Form states are now managed by AreaFormModal

  // ── Filtered data ──
  const filteredLands = useMemo(() => {
    return landPlots.filter(l => 
      !searchQuery || 
      l.plot_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      l.plot_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.owner_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [landPlots, searchQuery]);

  const filteredGardens = useMemo(() => {
    return gardens.filter(g => 
      !searchQuery || 
      g.garden_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      g.garden_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.soil_type?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [gardens, searchQuery]);

  const filteredPlantings = useMemo(() => {
    return plantings.filter(p => 
      !searchQuery || 
      p.nama_tanaman?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.garden?.garden_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.device?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [plantings, searchQuery]);

  // ── Pagination ──
  const totalLandPages = Math.max(1, Math.ceil(filteredLands.length / PER_PAGE));
  const totalGardenPages = Math.max(1, Math.ceil(filteredGardens.length / PER_PAGE));
  const totalPlantingPages = Math.max(1, Math.ceil(filteredPlantings.length / PER_PAGE));

  const paginatedLands = filteredLands.slice((pageLand - 1) * PER_PAGE, pageLand * PER_PAGE);
  const paginatedGardens = filteredGardens.slice((pageGarden - 1) * PER_PAGE, pageGarden * PER_PAGE);
  const paginatedPlantings = filteredPlantings.slice((pagePlanting - 1) * PER_PAGE, pagePlanting * PER_PAGE);

  useEffect(() => {
    setPageLand(1);
    setPageGarden(1);
    setPagePlanting(1);
  }, [searchQuery, activeTab]);

  // ── Helpers ──
  const nextLandId = () => (landPlots.length > 0 ? Math.max(...landPlots.map(l => l.id)) + 1 : 1);
  const nextGardenId = () => (gardens.length > 0 ? Math.max(...gardens.map(g => g.id)) + 1 : 1);

// Helper generateUniqueCode, cleanAddress, dan reverseGeocode telah dipindahkan ke utils

  const openAddForm = () => {
    setEditingLand(null);
    setEditingGarden(null);
    setEditingPlanting(null);
    setIsFormOpen(true);
  };

  const openEditLand = (land: any) => {
    setEditingLand(land);
    setEditingGarden(null);
    setEditingPlanting(null);
    setIsFormOpen(true);
  };

  const openEditGarden = (garden: any) => {
    setEditingGarden(garden);
    setEditingLand(null);
    setEditingPlanting(null);
    setIsFormOpen(true);
  };

  const openEditPlanting = (planting: any) => {
    setEditingPlanting(planting);
    setEditingGarden(null);
    setEditingLand(null);
    setIsFormOpen(true);
  };

  // ── Delete handler ──
  const confirmDelete = async () => {
    if (!deleteTarget || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let url = '';
      if (deleteTarget.type === 'lahan') url = `/land-plots/${deleteTarget.id}`;
      else if (deleteTarget.type === 'kebun') url = `/gardens/${deleteTarget.id}`;
      else if (deleteTarget.type === 'tanaman') url = `/plantings/${deleteTarget.id}`;

      await api.delete(url);
      
      let msg = '';
      if (deleteTarget.type === 'lahan') msg = 'Lahan berhasil dihapus!';
      else if (deleteTarget.type === 'kebun') msg = 'Kebun berhasil dihapus!';
      else if (deleteTarget.type === 'tanaman') msg = 'Tanaman berhasil dihapus!';

      toast.success(msg);
      await fetchData();
    } catch (e: any) {
      console.error(e);
      const msg = e.response?.data?.message || 'Gagal menghapus data dari server.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
      setDeleteTarget(null);
    }
  };

  // Parent Land & Sibling Gardens logic moved to AreaFormModal

  // ──────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────
  return (
    <div className="space-y-6 px-4 md:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">{t("Lahan, Kebun, dan Tanaman")}</h1>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {t("Pengelolaan pemetaan GIS poligon lahan, blok kebun, dan tanaman aktif")}
            </p>
          </div>
        </div>
        {userRole !== 'viewer' && (
          <Button className="h-11 px-5 rounded-2xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-all cursor-pointer gap-2 shrink-0" onClick={openAddForm}>
            <Plus size={18} /> {activeTab === 'lahan' ? t('Tambah Lahan') : activeTab === 'kebun' ? t('Tambah Kebun') : t('Tambah Tanaman')}
          </Button>
        )}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">{t("Total Lahan Induk")}</span>
            <span className="text-3xl font-black tracking-tight text-foreground">{landPlots.length}</span>
            <span className="text-[11px] font-semibold text-muted-foreground">{t("Plot Area Terdaftar")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <MapPin size={24} />
          </div>
        </div>

        <div className="bg-card p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">{t("Total Kebun / Blok")}</span>
            <span className="text-3xl font-black tracking-tight text-foreground">{gardens.length}</span>
            <span className="text-[11px] font-semibold text-muted-foreground">{t("Zonasi Blok Perkebunan")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <Trees size={24} />
          </div>
        </div>

        <div className="bg-card p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t("Tanaman Aktif")}</span>
            <span className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">{plantings.filter(p => p.is_active).length}</span>
            <span className="text-[11px] font-semibold text-emerald-700/80 dark:text-emerald-400/80">{t("Budidaya Berjalan")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <Sprout size={24} />
          </div>
        </div>

        <div className="bg-card p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">{t("Total Luas Area")}</span>
            <span className="text-3xl font-black tracking-tight text-foreground">
              {landPlots.reduce((sum, l) => sum + Number(l.area_hectare || 0), 0).toFixed(1)} <span className="text-sm font-extrabold text-muted-foreground">Ha</span>
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">{t("Cakupan GIS Terdaftar")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform">
            <Globe size={24} />
          </div>
        </div>
      </div>

      {/* Overview GIS Map */}
      <OverviewMap landPlots={landPlots} gardens={gardens} />

      {/* Tab Switcher */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <TabsList className="bg-muted/50 p-1.5 rounded-2xl h-12 shadow-sm border border-border/40 w-full sm:w-auto">
            <TabsTrigger value="lahan" className="rounded-xl font-extrabold px-6 py-2 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all flex items-center gap-2">
              <MapPin size={14} />
              {t('Lahan Induk')} ({landPlots.length})
            </TabsTrigger>
            <TabsTrigger value="kebun" className="rounded-xl font-extrabold px-6 py-2 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all flex items-center gap-2">
              <Trees size={14} />
              {t('Kebun / Blok')} ({gardens.length})
            </TabsTrigger>
            <TabsTrigger value="tanaman" className="rounded-xl font-extrabold px-6 py-2 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all flex items-center gap-2">
              <Sprout size={14} />
              {t('Tanaman')} ({plantings.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="lahan" className="w-full">
          <Card className="border-none shadow-sm shadow-black/5 overflow-hidden w-full rounded-3xl">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className="py-3 pl-6 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Kode Lahan')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Nama Lahan')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Pemilik')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Alamat')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">{t('Luas (Ha)')}</TableHead>
                      {userRole !== 'viewer' && (
                        <TableHead className="py-3 pr-6 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">{t('Aksi')}</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLands.map(l => (
                      <TableRow key={l.id} className="hover:bg-muted/20 transition-colors border-b border-border/50 group">
                        <TableCell className="py-3 pl-6 text-sm">
                          <Badge variant="outline" className="font-mono text-xs bg-muted/40 font-bold px-2.5 py-0.5">{l.plot_code}</Badge>
                        </TableCell>
                        <TableCell className="py-3 text-sm font-bold text-foreground">
                          {l.plot_name}
                        </TableCell>
                        <TableCell className="py-3 text-sm font-medium text-muted-foreground">{l.owner_name || '-'}</TableCell>
                        <TableCell className="py-3 text-sm font-medium text-muted-foreground max-w-[220px] whitespace-normal break-words">
                          <span className="line-clamp-2" title={cleanAddress(l.address) || '-'}>{cleanAddress(l.address) || '-'}</span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-center">
                          <Badge variant="secondary" className="font-bold text-xs px-2.5 py-0.5">{Number(l.area_hectare || 0).toFixed(2)} Ha</Badge>
                        </TableCell>
                        {userRole !== 'viewer' && (
                          <TableCell className="py-3 pr-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8.5 w-8.5 rounded-xl border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shadow-xs transition-all"
                                onClick={() => openEditLand(l)}
                                title={t('Edit Lahan')}
                              >
                                <Edit size={14} />
                              </Button>
                              {userRole === 'admin' && (
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8.5 w-8.5 rounded-xl border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 cursor-pointer shadow-xs transition-all"
                                  onClick={() => setDeleteTarget({ type: 'lahan', id: l.id })}
                                  title={t('Hapus Lahan')}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {filteredLands.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-40 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Search size={32} className="opacity-20" />
                            <p className="font-bold text-sm">{t('Belum ada data Lahan')}</p>
                            <p className="text-xs">{t('Klik "Tambah Lahan" untuk memulai')}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination for Lahan */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-border/50 gap-4 bg-card">
                <p className="text-xs text-muted-foreground font-semibold">
                  {t('Menampilkan')} {filteredLands.length > 0 ? ((pageLand - 1) * PER_PAGE) + 1 : 0}-{Math.min(pageLand * PER_PAGE, filteredLands.length)} {t('dari')} {filteredLands.length} {t('data')}
                </p>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pageLand <= 1} 
                    onClick={() => setPageLand(p => p - 1)}
                    className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    {t('Sebelumnya')}
                  </Button>
                  <div className="flex items-center mx-2 gap-1">
                    {Array.from({ length: Math.min(totalLandPages, 5) }, (_, i) => {
                      let p: number;
                      if (totalLandPages <= 5) p = i + 1;
                      else if (pageLand <= 3) p = i + 1;
                      else if (pageLand >= totalLandPages - 2) p = totalLandPages - 4 + i;
                      else p = pageLand - 2 + i;
                      
                      return (
                        <Button 
                          key={p} 
                          variant={pageLand === p ? "default" : "outline"} 
                          size="sm" 
                          onClick={() => setPageLand(p)}
                          className={cn(
                            "h-8 w-8 text-xs font-semibold rounded-lg p-0 transition-all",
                            pageLand === p ? "shadow-lg shadow-primary/20" : ""
                          )}
                        >
                          {p}
                        </Button>
                      );
                    })}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pageLand >= totalLandPages} 
                    onClick={() => setPageLand(p => p + 1)}
                    className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    {t('Berikutnya')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kebun" className="w-full">
          <Card className="border-none shadow-sm shadow-black/5 overflow-hidden w-full rounded-3xl">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className="py-3 pl-6 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Kode Kebun')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Nama Kebun')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Lahan Induk')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Tipe Tanah')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Tanaman')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground text-center">{t('Luas (Ha)')}</TableHead>
                      {userRole !== 'viewer' && (
                        <TableHead className="py-3 pr-6 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">{t('Aksi')}</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedGardens.map(g => {
                      const parent = landPlots.find(l => l.id === g.land_plot_id);
                      return (
                        <TableRow key={g.id} className="hover:bg-muted/20 transition-colors border-b border-border/50 group">
                          <TableCell className="py-3 pl-6 text-sm">
                            <Badge variant="outline" className="font-mono text-xs bg-muted/40 font-bold px-2.5 py-0.5">{g.garden_code}</Badge>
                          </TableCell>
                          <TableCell className="py-3 text-sm font-bold text-foreground">
                            {g.garden_name}
                            {g.jarak_jalan_m != null && g.jarak_jalan_m !== '' ? (
                              <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">{t('Jarak Jalan')}: {g.jarak_jalan_m} m</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="py-3 text-sm font-medium text-muted-foreground">{parent?.plot_name || 'N/A'}</TableCell>
                          <TableCell className="py-3 text-sm font-medium text-muted-foreground">
                            {g.soil_type ? (
                              <Badge variant="outline" className="text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">{g.soil_type}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="py-3 text-sm font-medium text-muted-foreground">
                            {(() => {
                              const activePlantings = plantings.filter(p => p.garden_id === g.id && p.is_active);
                              if (activePlantings.length > 0) {
                                return activePlantings.map(p => (
                                  <Badge key={p.id} variant="outline" className="mr-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs font-bold">
                                    {p.komoditi?.nama_komoditi || p.nama_tanaman}
                                  </Badge>
                                ));
                              }
                              return <span className="text-muted-foreground italic text-xs">{t('Belum ditanami')}</span>;
                            })()}
                          </TableCell>
                          <TableCell className="py-3 text-sm text-center">
                            <Badge variant="secondary" className="font-bold text-xs px-2.5 py-0.5">{Number(g.area_hectare || 0).toFixed(2)} Ha</Badge>
                          </TableCell>
                          {userRole !== 'viewer' && (
                            <TableCell className="py-3 pr-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8.5 w-8.5 rounded-xl border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shadow-xs transition-all"
                                  onClick={() => openEditGarden(g)}
                                  title={t('Edit Kebun')}
                                >
                                  <Edit size={14} />
                                </Button>
                                {userRole === 'admin' && (
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8.5 w-8.5 rounded-xl border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 cursor-pointer shadow-xs transition-all"
                                    onClick={() => setDeleteTarget({ type: 'kebun', id: g.id })}
                                    title={t('Hapus Kebun')}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                    {filteredGardens.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-40 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Search size={32} className="opacity-20" />
                            <p className="font-bold text-sm">{t('Belum ada data Kebun')}</p>
                            <p className="text-xs">{t('Tambahkan Lahan terlebih dahulu, lalu buat Kebun di dalamnya')}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination for Kebun */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-border/50 gap-4 bg-card">
                <p className="text-xs text-muted-foreground font-semibold">
                  {t('Menampilkan')} {filteredGardens.length > 0 ? ((pageGarden - 1) * PER_PAGE) + 1 : 0}-{Math.min(pageGarden * PER_PAGE, filteredGardens.length)} {t('dari')} {filteredGardens.length} {t('data')}
                </p>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pageGarden <= 1} 
                    onClick={() => setPageGarden(p => p - 1)}
                    className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    {t('Sebelumnya')}
                  </Button>
                  <div className="flex items-center mx-2 gap-1">
                    {Array.from({ length: Math.min(totalGardenPages, 5) }, (_, i) => {
                      let p: number;
                      if (totalGardenPages <= 5) p = i + 1;
                      else if (pageGarden <= 3) p = i + 1;
                      else if (pageGarden >= totalGardenPages - 2) p = totalGardenPages - 4 + i;
                      else p = pageGarden - 2 + i;
                      
                      return (
                        <Button 
                          key={p} 
                          variant={pageGarden === p ? "default" : "outline"} 
                          size="sm" 
                          onClick={() => setPageGarden(p)}
                          className={cn(
                            "h-8 w-8 text-xs font-semibold rounded-lg p-0 transition-all",
                            pageGarden === p ? "shadow-lg shadow-primary/20" : ""
                          )}
                        >
                          {p}
                        </Button>
                      );
                    })}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pageGarden >= totalGardenPages} 
                    onClick={() => setPageGarden(p => p + 1)}
                    className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    {t('Berikutnya')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tanaman" className="w-full">
          <Card className="border-none shadow-sm shadow-black/5 overflow-hidden w-full rounded-3xl">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className="py-3 pl-6 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Nama Tanaman')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Lokasi (Kebun)')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Komoditi')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Perangkat IoT')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Tgl Tanam')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Est. Panen')}</TableHead>
                      <TableHead className="py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('Fase / Status')}</TableHead>
                      {userRole !== 'viewer' && (
                        <TableHead className="py-3 pr-6 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">{t('Aksi')}</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPlantings.map(p => (
                      <TableRow key={p.id} className="hover:bg-muted/20 transition-colors border-b border-border/50 group">
                        <TableCell className="py-3 pl-6 text-sm font-bold text-foreground">{p.nama_tanaman}</TableCell>
                        <TableCell className="py-3 text-sm font-medium text-muted-foreground">{p.garden?.garden_name || '-'}</TableCell>
                        <TableCell className="py-3 text-sm">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-bold text-xs">{p.komoditi?.nama_komoditi || '-'}</Badge>
                        </TableCell>
                        <TableCell className="py-3 text-sm">
                          {(p.device?.name || p.device?.device_code) ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 font-bold text-xs gap-1"><Radio size={11} /> {p.device.name || p.device.device_code}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-sm font-mono font-semibold text-muted-foreground">
                          {p.tanggal_tanam ? new Date(p.tanggal_tanam).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </TableCell>
                        <TableCell className="py-3 text-sm font-mono font-semibold text-muted-foreground">
                          {p.estimasi_panen ? new Date(p.estimasi_panen).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </TableCell>
                        <TableCell className="py-3 text-sm">
                          <Badge className={cn(
                            "font-black text-xs rounded-full border-none shadow-xs px-3 py-1 capitalize",
                            p.status_fase === 'Persiapan' ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                            p.status_fase === 'Vegetatif' ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                            p.status_fase === 'Generatif' ? "bg-purple-500/15 text-purple-700 dark:text-purple-400" :
                            p.status_fase === 'Panen' ? "bg-blue-500/15 text-blue-700 dark:text-blue-400" :
                            "bg-slate-500/15 text-slate-700 dark:text-slate-400"
                          )}>
                            {p.status_fase}
                          </Badge>
                        </TableCell>
                        {userRole !== 'viewer' && (
                          <TableCell className="py-3 pr-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8.5 w-8.5 rounded-xl border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shadow-xs transition-all"
                                onClick={() => openEditPlanting(p)}
                                title={t('Edit Tanaman')}
                              >
                                <Edit size={14} />
                              </Button>
                              {userRole === 'admin' && (
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8.5 w-8.5 rounded-xl border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 cursor-pointer shadow-xs transition-all"
                                  onClick={() => setDeleteTarget({ type: 'tanaman' as any, id: p.id })}
                                  title={t('Hapus Tanaman')}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {paginatedPlantings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-40 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Search size={32} className="opacity-20" />
                            <p className="font-bold text-sm">{t('Belum ada data Tanaman')}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination Tanaman */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-border/50 gap-4 bg-card">
                <p className="text-xs text-muted-foreground font-semibold">
                  {t('Menampilkan')} {filteredPlantings.length > 0 ? ((pagePlanting - 1) * PER_PAGE) + 1 : 0}-{Math.min(pagePlanting * PER_PAGE, filteredPlantings.length)} {t('dari')} {filteredPlantings.length} {t('data')}
                </p>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pagePlanting <= 1} 
                    onClick={() => setPagePlanting(p => p - 1)}
                    className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    {t('Sebelumnya')}
                  </Button>
                  <div className="flex items-center mx-2 gap-1">
                    {Array.from({ length: Math.min(totalPlantingPages, 5) }, (_, i) => {
                      let p: number;
                      if (totalPlantingPages <= 5) p = i + 1;
                      else if (pagePlanting <= 3) p = i + 1;
                      else if (pagePlanting >= totalPlantingPages - 2) p = totalPlantingPages - 4 + i;
                      else p = pagePlanting - 2 + i;
                      
                      return (
                        <Button 
                          key={p} 
                          variant={pagePlanting === p ? "default" : "outline"} 
                          size="sm" 
                          onClick={() => setPagePlanting(p)}
                          className={cn(
                            "h-8 w-8 text-xs font-semibold rounded-lg p-0 transition-all",
                            pagePlanting === p ? "shadow-lg shadow-primary/20" : ""
                          )}
                        >
                          {p}
                        </Button>
                      );
                    })}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pagePlanting >= totalPlantingPages} 
                    onClick={() => setPagePlanting(p => p + 1)}
                    className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    {t('Berikutnya')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════════════════════════════════════
          DIALOG: FORM TAMBAH / EDIT (Map LEFT | Form RIGHT)
          ══════════════════════════════════════════════════════ */}
      <AreaFormModal
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        activeTab={activeTab}
        editingLand={editingLand}
        editingGarden={editingGarden}
        editingPlanting={editingPlanting}
        landPlots={landPlots}
        gardens={gardens}
        nodes={nodes}
        komoditiList={komoditiList}
        onSaveSuccess={fetchData}
      />

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!isSubmitting && !open) setDeleteTarget(null); }}>
        <AlertDialogContent className="sm:max-w-[460px] rounded-[28px] border border-border/80 shadow-2xl p-6 sm:p-7 bg-card gap-0 overflow-hidden">
          <AlertDialogHeader className="flex flex-row items-start gap-4 pb-5 mb-5 border-b border-border/60 space-y-0 text-left">
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0 shadow-xs">
              <Trash2 size={22} />
            </div>
            <div className="flex flex-col gap-1 pr-6">
              <AlertDialogTitle className="text-xl font-black tracking-tight text-foreground leading-snug">
                Hapus {deleteTarget?.type === 'lahan' ? 'Lahan' : deleteTarget?.type === 'kebun' ? 'Kebun' : 'Tanaman'}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
                {deleteTarget?.type === 'lahan'
                  ? 'Semua kebun yang terkait dengan lahan ini juga akan dihapus. Tindakan ini tidak dapat dibatalkan.'
                  : deleteTarget?.type === 'kebun'
                  ? 'Data kebun ini akan dihapus secara permanen beserta data tanaman terkait. Tindakan ini tidak dapat dibatalkan.'
                  : 'Data tanaman ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.'
                }
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-2 flex flex-row items-center justify-end gap-3 space-x-0">
            <AlertDialogCancel className="h-11 px-6 rounded-2xl border-border/80 font-extrabold text-xs bg-muted/30 hover:bg-muted transition-all m-0" disabled={isSubmitting}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!isSubmitting) confirmDelete();
              }}
              disabled={isSubmitting}
              className="h-11 px-7 rounded-2xl font-black text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 transition-all cursor-pointer m-0"
            >
              {isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

export default AreaManagementView;
