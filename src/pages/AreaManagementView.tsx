import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Layers, Plus, Map as MapIcon, Edit, Trash2, Search, Trees, Sprout, Database, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
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
import { MapContainer, TileLayer, Polygon, Tooltip as LeafletTooltip, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '@/lib/utils';
import api from '../lib/api';
import { generateUniqueCode } from '../utils/generators';
import { cleanAddress, reverseGeocode } from '../utils/geolocation';
import AreaFormModal from '../components/area/AreaFormModal';
// Overview map component that shows all polygons
const OverviewMap = React.memo(({ landPlots, gardens }: { landPlots: any[], gardens: any[] }) => {
  const mapRef = useRef<L.Map | null>(null);

  // Jika ada data koordinat, fit bounds ke lokasi yang ada
  useEffect(() => {
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
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [landPlots, gardens]);

  const renderGeoJSONPolygon = (polygon: any, color: string, label: string) => {
    try {
      const geom = typeof polygon === 'string' ? JSON.parse(polygon) : polygon;
      if (!geom?.coordinates?.[0]) return null;
      const positions = geom.coordinates[0].map((c: number[]) => [c[1], c[0]] as [number, number]);
      return (
        <Polygon key={label} positions={positions} pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 2 }}>
          <LeafletTooltip sticky>{label}</LeafletTooltip>
        </Polygon>
      );
    } catch { return null; }
  };

  return (
    <Card className="border-none shadow-xl shadow-black/5 overflow-hidden">
      <CardContent className="p-0">
        <div className="h-[300px] w-full">
          <MapContainer
            ref={mapRef}
            center={[-6.8396, 107.9224]}
            zoom={10}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <LayersControl position="topleft">
              <LayersControl.BaseLayer checked name="Satelit">
                <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="© Google" maxZoom={20} />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Peta Jalan (OSM)">
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/attributions'>CARTO</a>" maxZoom={19} />
              </LayersControl.BaseLayer>
            </LayersControl>
            {/* Overlay label transparan: nama daerah, jalan — teks tegas tanpa ikon POI */}
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png" maxZoom={20} pane="overlayPane" />
            {landPlots.map(l => l.polygon && renderGeoJSONPolygon(l.polygon, l.color || '#F59E0B', `Lahan: ${l.plot_name}`))}
            {gardens.map(g => g.polygon && renderGeoJSONPolygon(g.polygon, g.color || '#22C55E', `Kebun: ${g.garden_name}`))}
          </MapContainer>
        </div>
        <div className="px-4 py-2 bg-muted/20 flex items-center gap-6 text-[10px] font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 bg-blue-500/20 border border-blue-500 inline-block rounded-sm" /> Lahan ({landPlots.length})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 bg-emerald-500/20 border border-emerald-500 inline-block rounded-sm" /> Kebun ({gardens.length})
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

// ============================================================
// Component: AreaManagementView
// Manages Land Plots and Gardens with GIS polygon drawing.
// Layout: Map LEFT | Form RIGHT (matching web-iot-carbon style)
// Fields: Aligned with Laravel migrations
// ============================================================

const AreaManagementView = React.memo(({ userRole }: { userRole?: string }) => {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Manajemen Lahan, Kebun & Tanaman</h1>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder={activeTab === 'lahan' ? "Cari Nama Lahan, Pemilik, Alamat..." : activeTab === 'kebun' ? "Cari Nama Kebun, Tipe Tanah..." : "Cari Nama Tanaman..."}
              className="pl-10 h-11 bg-card border-none shadow-sm rounded-md font-normal text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {userRole !== 'viewer' && (
            <Button className="h-11 px-5 rounded-md font-bold gap-2 shadow-sm shadow-primary/20 text-sm" onClick={openAddForm}>
              <Plus size={20} /> {activeTab === 'lahan' ? 'Tambah Lahan' : activeTab === 'kebun' ? 'Tambah Kebun' : 'Tambah Tanaman'}
            </Button>
          )}
        </div>
      </div>

      {/* Tab Switcher - CENTERED ABOVE TABLE */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex flex-col">
        <div className="flex justify-center mb-2">
          <TabsList className="bg-muted/50 p-1.5 rounded-lg h-14 shadow-sm border border-border/30">
            <TabsTrigger value="lahan" className="rounded-md font-bold px-8 py-2.5 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all flex-1 md:flex-none">
              Lahan Induk
            </TabsTrigger>
            <TabsTrigger value="kebun" className="rounded-md font-bold px-8 py-2.5 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all flex-1 md:flex-none">
              Kebun / Blok
            </TabsTrigger>
            <TabsTrigger value="tanaman" className="rounded-md font-bold px-8 py-2.5 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all flex-1 md:flex-none">
              Tanaman
            </TabsTrigger>
          </TabsList>
        </div>



        <TabsContent value="lahan" className="w-full">
          <Card className="border-none shadow-sm shadow-black/5 overflow-hidden w-full">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-bold text-xs py-4 pl-6">Kode Lahan</TableHead>
                      <TableHead className="font-bold text-xs py-4">Nama Lahan</TableHead>
                      <TableHead className="font-bold text-xs py-4">Pemilik</TableHead>
                      <TableHead className="font-bold text-xs py-4">Alamat</TableHead>

                      <TableHead className="font-bold text-xs py-4 text-center">Luas (Ha)</TableHead>
                      {userRole !== 'viewer' && (
                        <TableHead className="font-bold text-xs py-4 text-right pr-6">Aksi</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLands.map(l => (
                      <TableRow key={l.id} className="hover:bg-muted/20 transition-colors group">
                        <TableCell className="text-sm pl-6">{l.plot_code}</TableCell>
                        <TableCell className="text-sm">
                          {l.plot_name}
                        </TableCell>
                        <TableCell className="text-sm">{l.owner_name || '-'}</TableCell>
                        <TableCell className="text-sm max-w-[200px] whitespace-normal break-words">
                          <span className="line-clamp-2" title={cleanAddress(l.address) || '-'}>{cleanAddress(l.address) || '-'}</span>
                        </TableCell>

                        <TableCell className="text-sm text-center">{Number(l.area_hectare || 0).toFixed(2)}</TableCell>
                        {userRole !== 'viewer' && (
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                                onClick={() => openEditLand(l)}
                              >
                                <Edit size={15} />
                              </Button>
                              {userRole === 'admin' && (
                                <Button
                                  size="icon"
                                  className="h-8 w-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm"
                                  onClick={() => setDeleteTarget({ type: 'lahan', id: l.id })}
                                >
                                  <Trash2 size={15} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {filteredLands.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-20">
                          <div className="flex flex-col items-center gap-3 opacity-30">
                            <Database size={48} />
                            <p className="font-bold text-lg">Belum ada data Lahan</p>
                            <p className="text-sm">Klik "Tambah Lahan" untuk memulai</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination for Lahan */}
              <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 border-t border-border/50 gap-4 bg-white">
                <p className="text-xs text-muted-foreground font-medium">
                  Menampilkan {filteredLands.length > 0 ? ((pageLand - 1) * PER_PAGE) + 1 : 0}-{Math.min(pageLand * PER_PAGE, filteredLands.length)} dari {filteredLands.length} data
                </p>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pageLand <= 1} 
                    onClick={() => setPageLand(p => p - 1)}
                    className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    Sebelumnya
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
                    Berikutnya
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kebun" className="w-full">
          <Card className="border-none shadow-sm shadow-black/5 overflow-hidden w-full">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-bold text-xs py-4 pl-6">Kode Kebun</TableHead>
                      <TableHead className="font-bold text-xs py-4">Nama Kebun</TableHead>
                      <TableHead className="font-bold text-xs py-4">Lahan Induk</TableHead>
                      <TableHead className="font-bold text-xs py-4">Tipe Tanah</TableHead>
                      <TableHead className="font-bold text-xs py-4">Tanaman</TableHead>
                      <TableHead className="font-bold text-xs py-4 text-center">Luas (Ha)</TableHead>
                      <TableHead className="font-bold text-xs py-4 text-right pr-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedGardens.map(g => {
                      const parent = landPlots.find(l => l.id === g.land_plot_id);
                      return (
                        <TableRow key={g.id} className="hover:bg-muted/20 transition-colors group">
                          <TableCell className="text-sm pl-6">{g.garden_code}</TableCell>
                          <TableCell className="text-sm">
                            {g.garden_name}
                            {g.jarak_jalan_m != null && g.jarak_jalan_m !== '' ? (
                              <div className="text-[10px] text-muted-foreground mt-0.5">Jarak Jalan: {g.jarak_jalan_m} m</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-sm">{parent?.plot_name || 'N/A'}</TableCell>
                          <TableCell className="text-sm">{g.soil_type || '-'}</TableCell>
                          <TableCell className="text-sm">
                            {(() => {
                              const activePlantings = plantings.filter(p => p.garden_id === g.id && p.is_active);
                              if (activePlantings.length > 0) {
                                return activePlantings.map(p => p.komoditi?.nama_komoditi || p.nama_tanaman).join(', ');
                              }
                              return <span className="text-muted-foreground italic">Belum ditanami</span>;
                            })()}
                          </TableCell>
                          <TableCell className="text-sm text-center">{Number(g.area_hectare || 0).toFixed(2)}</TableCell>
                          {userRole !== 'viewer' && (
                            <TableCell className="text-right pr-6">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                                  onClick={() => openEditGarden(g)}
                                >
                                  <Edit size={15} />
                                </Button>
                                {userRole === 'admin' && (
                                  <Button
                                    size="icon"
                                    className="h-8 w-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm"
                                    onClick={() => setDeleteTarget({ type: 'kebun', id: g.id })}
                                  >
                                    <Trash2 size={15} />
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
                        <TableCell colSpan={7} className="text-center py-20">
                          <div className="flex flex-col items-center gap-3 opacity-30">
                            <Trees size={48} />
                            <p className="font-bold text-lg">Belum ada data Kebun</p>
                            <p className="text-sm">Tambahkan Lahan terlebih dahulu, lalu buat Kebun di dalamnya</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination for Kebun */}
              <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 border-t border-border/50 gap-4 bg-white">
                <p className="text-xs text-muted-foreground font-medium">
                  Menampilkan {filteredGardens.length > 0 ? ((pageGarden - 1) * PER_PAGE) + 1 : 0}-{Math.min(pageGarden * PER_PAGE, filteredGardens.length)} dari {filteredGardens.length} data
                </p>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pageGarden <= 1} 
                    onClick={() => setPageGarden(p => p - 1)}
                    className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    Sebelumnya
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
                    Berikutnya
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tanaman" className="w-full">
          <Card className="border-none shadow-sm shadow-black/5 overflow-hidden w-full">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-bold text-xs py-4 pl-6">Nama Tanaman</TableHead>
                      <TableHead className="font-bold text-xs py-4">Lokasi (Kebun)</TableHead>
                      <TableHead className="font-bold text-xs py-4">Komoditi</TableHead>
                      <TableHead className="font-bold text-xs py-4">Perangkat IoT</TableHead>
                      <TableHead className="font-bold text-xs py-4">Tgl Tanam</TableHead>
                      <TableHead className="font-bold text-xs py-4">Est. Panen</TableHead>
                      <TableHead className="font-bold text-xs py-4">Fase / Status</TableHead>
                      {userRole !== 'viewer' && (
                        <TableHead className="font-bold text-xs py-4 text-right pr-6">Aksi</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPlantings.map(p => (
                      <TableRow key={p.id} className="hover:bg-muted/20 transition-colors group">
                        <TableCell className="text-sm pl-6 font-medium">{p.nama_tanaman}</TableCell>
                        <TableCell className="text-sm">{p.garden?.garden_name || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {p.komoditi?.nama_komoditi || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {(p.device?.name || p.device?.device_code) ? (
                            <span className="font-medium text-blue-700">{p.device.name || p.device.device_code}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.tanggal_tanam ? new Date(p.tanggal_tanam).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.estimasi_panen ? new Date(p.estimasi_panen).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className={cn(
                            "font-medium",
                            p.status_fase === 'Persiapan' ? "text-amber-600" :
                            p.status_fase === 'Vegetatif' ? "text-green-600" :
                            p.status_fase === 'Generatif' ? "text-purple-600" :
                            p.status_fase === 'Panen' ? "text-blue-600" :
                            "text-foreground"
                          )}>
                            {p.status_fase}
                          </span>
                        </TableCell>
                        {userRole !== 'viewer' && (
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                                onClick={() => openEditPlanting(p)}
                              >
                                <Edit size={15} />
                              </Button>
                              {userRole === 'admin' && (
                                <Button
                                  size="icon"
                                  className="h-8 w-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm"
                                  onClick={() => setDeleteTarget({ type: 'tanaman' as any, id: p.id })}
                                >
                                  <Trash2 size={15} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {paginatedPlantings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                          {searchQuery ? 'Tidak ada data tanaman yang cocok dengan pencarian.' : 'Belum ada data tanaman.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination Tanaman */}
              <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 border-t border-border/50 gap-4 bg-white">
                <p className="text-xs text-muted-foreground font-medium">
                  Menampilkan {filteredPlantings.length > 0 ? ((pagePlanting - 1) * PER_PAGE) + 1 : 0}-{Math.min(pagePlanting * PER_PAGE, filteredPlantings.length)} dari {filteredPlantings.length} data
                </p>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pagePlanting <= 1} 
                    onClick={() => setPagePlanting(p => p - 1)}
                    className="h-8 px-3 text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    Sebelumnya
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
                    Berikutnya
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
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {deleteTarget?.type === 'lahan' ? 'Lahan' : deleteTarget?.type === 'kebun' ? 'Kebun' : 'Tanaman'}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'lahan'
                ? 'Semua kebun yang terkait dengan lahan ini juga akan dihapus. Tindakan ini tidak dapat dibatalkan.'
                : deleteTarget?.type === 'kebun'
                ? 'Data kebun ini akan dihapus secara permanen beserta data tanaman terkait. Tindakan ini tidak dapat dibatalkan.'
                : 'Data tanaman ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl h-11 font-bold" disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!isSubmitting) confirmDelete();
              }}
              disabled={isSubmitting}
              className="rounded-xl h-11 font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
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
