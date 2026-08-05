import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Radio, Database, CloudSun, Map as MapIcon, BarChart3,
  FileText, Settings, Users, Bell, Search, Menu, X, Droplets, Thermometer,
  Wind, Battery, Signal, AlertTriangle, Leaf, LogIn, LogOut, Calendar as CalendarIcon,
  FlaskConical, Zap, Activity, Filter, Plus, Save, MoreVertical, Edit, Trash2,
  Download, CheckCircle2, Eye, EyeOff, Trees, Layers, Sprout, MapPin, SearchIcon, Share2, Map as MapIconS,
  QrCode, Camera, Upload
} from 'lucide-react';
import { toast } from 'sonner';
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter, ZAxis, Legend } from 'recharts';
import { IoTNode, User, UserRole } from '../lib/mockData';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import api from '../lib/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Map related overrides
import NodeMap from '../components/NodesManagement/NodeMap';
import NodeTable from '../components/NodesManagement/NodeTable';

// App specific imports
import { Html5Qrcode } from 'html5-qrcode';

// --- Helper Components Moved Outside ---


export default function NodesView({ nodes: propNodes, userRole }: { nodes?: IoTNode[], userRole?: string }) {
  const [nodes, setNodes] = useState<IoTNode[]>(propNodes || []);
  const [landPlots, setLandPlots] = useState<any[]>([]);
  const [gardens, setGardens] = useState<any[]>([]);
  const [nodeLocation, setNodeLocation] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-6.8315, 107.9160]);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(14);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<IoTNode | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const qrScannerRef = React.useRef<Html5Qrcode | null>(null);
  const qrFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (propNodes && propNodes.length > 0) {
      setNodes(propNodes);
    }
  }, [propNodes]);

  useEffect(() => {
    fetchNodes();
    fetchLandPlots();
    fetchGardens();

    // Phase 1 Cleanup: Release QR scanner hardware on unmount
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const fetchNodes = useCallback(async () => {
    try {
      const res = await api.get('/nodes');
      if (Array.isArray(res.data)) {
        setNodes(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch nodes', e);
    }
  }, []);

  const fetchLandPlots = useCallback(async () => {
    try {
      const res = await api.get('/land-plots');
      const data = Array.isArray(res.data) ? res.data : res.data?.data;

      if (Array.isArray(data)) {
        const formatted = data.map((d: any) => {
          let polygonData: any[] = [];
          if (d.polygon) {
            try {
              const poly = typeof d.polygon === 'string' ? JSON.parse(d.polygon) : d.polygon;
              if (poly.coordinates) {
                polygonData = Array.isArray(poly.coordinates[0]) && typeof poly.coordinates[0][0] === 'number'
                  ? poly.coordinates
                  : poly.coordinates[0];
              } else {
                polygonData = poly;
              }
            } catch { polygonData = []; }
          }
          return {
            id: String(d.id),
            name: d.plot_name || d.name || "Tanpa Nama",
            polygon: polygonData,
            latitude: d.latitude,
            longitude: d.longitude
          };
        });
        setLandPlots(formatted);
      }
    } catch (e) {
      console.error('Failed to fetch land plots', e);
    }
  }, []);

  const fetchGardens = useCallback(async () => {
    try {
      const res = await api.get('/gardens');
      const data = Array.isArray(res.data) ? res.data : res.data?.data;
      if (Array.isArray(data)) {
        setGardens(data);
      }
    } catch (e) {
      console.error('Failed to fetch gardens', e);
    }
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [nodeFilter, setNodeFilter] = useState('all');

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    location: '',
    latitude: '-6.831500',
    longitude: '107.916000',
    altitude: '720',
    lahanId: '',
    gardenId: '',
    firmware_version: 'V 1.0.0'
  });

  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || node.status === statusFilter;
      const matchesNode = nodeFilter === 'all' || node.id === nodeFilter;
      return matchesSearch && matchesStatus && matchesNode;
    });
  }, [nodes, searchQuery, statusFilter, nodeFilter]);

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      location: '',
      latitude: '-6.831500',
      longitude: '107.916000',
      altitude: '720',
      lahanId: '',
      gardenId: '',
      firmware_version: 'V 1.0.0'
    });
    setNodeLocation(null);
    setMapCenter([-6.8315, 107.9160]);
    setMapBounds(null);
    setMapZoom(15);
    setEditingNode(null);
    setIsQrScannerOpen(false);
    if (qrScannerRef.current) {
      try {
        qrScannerRef.current.stop().then(() => {
          qrScannerRef.current?.clear();
          qrScannerRef.current = null;
        }).catch(() => {});
      } catch (e) {}
    }
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsDialogOpen(true);
  };
  const handleOpenEdit = (node: IoTNode) => {
    setEditingNode(node);
    setFormData({
      id: node.id,
      name: node.name,
      location: node.location,
      latitude: node.coords?.[0]?.toString() || '-6.831500',
      longitude: node.coords?.[1]?.toString() || '107.916000',
      altitude: node.altitude?.toString() || '720',
      lahanId: String(node.lahanId || ''),
      gardenId: String(node.gardenId || ''),
      firmware_version: node.firmware_version || 'V 1.0.0'
    });

    // Fallback safe coordinates
    const lat = node.coords?.[0] ? Number(node.coords[0]) : -6.8315;
    const lng = node.coords?.[1] ? Number(node.coords[1]) : 107.9160;

    setNodeLocation([lat, lng]);
    setMapCenter([lat, lng]);
    setMapBounds(null);
    setMapZoom(15);
    setIsDialogOpen(true);
  };

  const handleDelete = async (db_id: number) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/nodes/${db_id}`);
      toast.success("Perangkat berhasil dihapus");
      fetchNodes();
      setIsDeleteDialogOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.message || "Gagal menghapus perangkat");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id) {
      toast.error('Gagal: ID Perangkat wajib diisi!');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        lahanId: formData.lahanId || null,
        gardenId: formData.gardenId || null
      };

      const url = editingNode
        ? `/nodes/${(editingNode as any).db_id}`
        : '/nodes';

      if (editingNode) {
        await api.put(url, payload);
      } else {
        await api.post(url, { ...payload, garden_id: formData.gardenId || null });
      }

      toast.success(editingNode ? "Perangkat berhasil diperbarui!" : "Perangkat baru berhasil didaftarkan!");
      fetchNodes();
      setIsDialogOpen(false);
      resetForm();
    } catch (e: any) {
      console.error("Save Exception:", e);
      let msg = e.response?.data?.message || e.message;
      if (e.response?.status === 422 && e.response?.data?.errors) {
        msg = Object.values(e.response.data.errors).flat().join('\\n');
      }
      toast.error('Gagal menyimpan Node: ' + msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // handleGetCurrentLocation moved below for better organization
  const handleGetCurrentLocation = async () => {
    // Simulate getting current location (Padasuka Sumedang area)
    const lat = -6.831500 + (Math.random() - 0.5) * 0.01;
    const lng = 107.916000 + (Math.random() - 0.5) * 0.01;

    setFormData(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
      altitude: 'Memuat...'
    }));

    try {
      const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
      const data = await res.json();
      const alt = (data && data.elevation && data.elevation.length > 0)
        ? Math.round(data.elevation[0])
        : Math.floor(700 + Math.random() * 50);

      setFormData(prev => ({ ...prev, altitude: alt.toString() }));
    } catch {
      setFormData(prev => ({ ...prev, altitude: Math.floor(700 + Math.random() * 50).toString() }));
    }
  };

  return (
    <div className="space-y-6 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manajemen Perangkat</h1>
        </div>
        {userRole !== 'viewer' && (
          <Button className="gap-2 h-11 px-6 shadow-lg shadow-primary/20" onClick={handleOpenAdd}>
            <Plus size={18} /> Tambah Node Baru
          </Button>
        )}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (isSubmitting) return;
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="sm:max-w-[1100px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl max-h-[95vh] flex flex-col">
            <DialogHeader className="p-6 pb-2 border-b border-border/50 bg-muted/20">
              <DialogTitle>{editingNode ? 'Edit Perangkat IoT' : 'Daftarkan Perangkat Baru'}</DialogTitle>
              <DialogDescription>
                Tentukan lokasi perangkat pada peta dan lengkapi detail identitas di sebelah kanan.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
              {/* ── LEFT: MAP PANEL (50%) ── */}
              <div className="w-full lg:w-[55%] relative bg-muted/10 min-h-[400px]">
                {/* Petunjuk Penggunaan Map */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full border border-border shadow-sm pointer-events-none whitespace-nowrap">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    Petunjuk: Klik pada peta untuk menentukan lokasi perangkat
                  </p>
                </div>

                <NodeMap
                  center={mapCenter}
                  zoom={mapZoom}
                  bounds={mapBounds as any}
                  nodeLocation={nodeLocation}
                  onPositionChange={(lat: number, lng: number, alt: string) => {
                    setNodeLocation([lat, lng]);
                    setFormData(prev => ({
                      ...prev,
                      latitude: lat.toFixed(7),
                      longitude: lng.toFixed(7),
                      altitude: alt
                    }));
                  }}
                  onMapClick={async (lat: number, lng: number) => {
                    setNodeLocation([lat, lng]);
                    setFormData(prev => ({
                      ...prev,
                      latitude: lat.toFixed(7),
                      longitude: lng.toFixed(7),
                      altitude: 'Memuat...'
                    }));

                    try {
                      const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
                      const data = await res.json();
                      if (data && data.elevation && data.elevation.length > 0) {
                        setFormData(prev => ({ ...prev, altitude: Math.round(data.elevation[0]).toString() }));
                      } else {
                        setFormData(prev => ({ ...prev, altitude: '0' }));
                      }
                    } catch {
                      setFormData(prev => ({ ...prev, altitude: '0' }));
                    }
                  }}
                  landPlots={landPlots}
                  gardens={gardens}
                  selectedPlotId={formData.lahanId}
                  selectedGardenId={formData.gardenId}
                  formData={formData}
                />

                <div className="absolute bottom-6 right-4 z-[1000]">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 shadow-lg gap-2 text-xs font-bold px-4"
                    onClick={handleGetCurrentLocation}
                  >
                    <MapPin size={14} /> Lokasi Saya
                  </Button>
                </div>
              </div>

              {/* ── RIGHT: FORM PANEL (45%) ── */}
              <div className="w-full lg:w-[45%] flex flex-col bg-card border-l border-border/50 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Placement Section - NOW AT TOP */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Penempatan & Lokasi</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Pilih Lahan</Label>
                        <Select
                          value={formData.lahanId}
                          onValueChange={(val) => {
                            const lahan = landPlots.find(l => String(l.id) === val);
                            if (lahan && lahan.polygon && Array.isArray(lahan.polygon)) {
                              try {
                                const validBounds = lahan.polygon
                                  .filter((c: any) => Array.isArray(c) && c.length >= 2)
                                  .map((c: any) => [Number(c[1]), Number(c[0])])
                                  .filter((c: any) => !isNaN(c[0]) && !isNaN(c[1]));
                                if (validBounds.length > 0) setMapBounds(validBounds);
                              } catch (e) {
                                console.error("Error setting map bounds for lahan", e);
                              }
                            }
                            setFormData(prev => ({
                              ...prev,
                              lahanId: val || '',
                              gardenId: '',
                              location: lahan?.name || prev.location
                            }));
                          }}
                        >
                          <SelectTrigger className="w-full h-12 border-none bg-muted/50 font-black text-xs uppercase tracking-wider rounded-xl px-4">
                            <SelectValue>
                              {landPlots.find(l => String(l.id) === formData.lahanId)?.name || (landPlots.length > 0 ? "Pilih Lahan Utama" : "Belum Ada Lahan")}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-2xl z-[2000]">
                            {landPlots.length === 0 && (
                              <div className="p-4 text-xs font-bold text-muted-foreground text-center">
                                Belum ada data lahan.<br />Silakan buat lahan di manajemen area.
                              </div>
                            )}
                            {landPlots.map(lahan => (
                              <SelectItem key={lahan.id} value={String(lahan.id)} className="font-bold py-3 text-xs uppercase hover:bg-primary/10">
                                {lahan.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Pilih Kebun (Sub-Lahan)</Label>
                        <Select
                          disabled={!formData.lahanId}
                          value={formData.gardenId}
                          onValueChange={(val) => {
                            const garden = gardens.find(g => String(g.id) === val);
                            if (garden && garden.polygon) {
                              try {
                                const poly = typeof garden.polygon === 'string' ? JSON.parse(garden.polygon) : garden.polygon;
                                // Handle deeply nested GeoJSON coords safely
                                const coords = poly.coordinates ?
                                  (Array.isArray(poly.coordinates[0]) && typeof poly.coordinates[0][0] === 'number' ? poly.coordinates : poly.coordinates[0])
                                  : poly;
                                if (Array.isArray(coords)) {
                                  const validBounds = coords
                                    .filter((c: any) => Array.isArray(c) && c.length >= 2)
                                    .map((c: any) => [Number(c[1]), Number(c[0])] as [number, number])
                                    .filter((c: any) => !isNaN(c[0]) && !isNaN(c[1]));
                                  if (validBounds.length > 0) setMapBounds(validBounds as any);
                                }
                              } catch (e) {
                                console.error("Error setting map bounds for garden", e);
                              }
                            }
                            setFormData(prev => ({
                              ...prev,
                              gardenId: val || '',
                              location: garden?.garden_name || prev.location
                            }));
                          }}
                        >
                          <SelectTrigger className="w-full h-12 border-none bg-muted/50 font-black text-xs uppercase tracking-wider rounded-xl px-4">
                            <SelectValue>
                              {(() => {
                                const g = gardens.find(g => String(g.id) === formData.gardenId);
                                if (!g) return gardens.length > 0 ? "Pilih Kebun" : "Belum Ada Kebun";
                                return `${g.garden_name} ${g.plant?.name ? `(${g.plant.name})` : ''}`;
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-2xl z-[2000]">
                            {gardens.filter(g => String(g.land_plot_id) === formData.lahanId).length === 0 && (
                              <div className="p-4 text-xs font-bold text-muted-foreground text-center">
                                Belum ada kebun.
                              </div>
                            )}
                            {gardens
                              .filter(g => String(g.land_plot_id) === formData.lahanId)
                              .map(garden => (
                                  <SelectItem key={garden.id} value={String(garden.id)} className="font-bold py-3 text-xs uppercase hover:bg-primary/10">
                                    {garden.garden_name} {garden.plant?.name ? `(${garden.plant.name})` : ''}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Identity Section - NOW BELOW PLACEMENT */}
                  <div className="space-y-4 pt-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Identitas Perangkat</p>
                    <div className="grid gap-4">
                      <div className="grid gap-1.5">
                        <Label className="text-[11px] font-bold text-muted-foreground uppercase">Nomor Seri Perangkat *</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="AGRISENSE-NODE-001"
                            value={formData.id}
                            className="h-11 rounded-xl bg-muted/20 border-border/50 focus:bg-background transition-all flex-1"
                            onChange={e => setFormData({ ...formData, id: e.target.value })}
                            disabled={!!editingNode && userRole !== 'admin'}
                          />
                          {!editingNode && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-11 w-11 rounded-xl border-primary/30 hover:bg-primary/10 shrink-0"
                              title="Scan QR Code"
                              onClick={() => {
                                if (isQrScannerOpen && qrScannerRef.current) {
                                  try {
                                    qrScannerRef.current.stop().then(() => {
                                      qrScannerRef.current?.clear();
                                      qrScannerRef.current = null;
                                    }).catch(() => {});
                                  } catch(e) {}
                                }
                                setIsQrScannerOpen(!isQrScannerOpen);
                              }}
                            >
                              <QrCode size={18} className="text-primary" />
                            </Button>
                          )}
                        </div>
                        {/* QR Scanner Panel */}
                        {isQrScannerOpen && !editingNode && (
                          <div className="mt-2 p-3 rounded-xl bg-muted/30 border border-border/50 space-y-3">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Scan QR Code Perangkat</p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2 text-xs flex-1 rounded-lg"
                                onClick={async () => {
                                  try {
                                    const scanner = new Html5Qrcode('qr-reader-node');
                                    qrScannerRef.current = scanner;
                                    await scanner.start(
                                      { facingMode: 'environment' },
                                      { fps: 10, qrbox: { width: 200, height: 200 } },
                                      (decodedText) => {
                                        let scannedId = decodedText;
                                        let scannedFw = '';
                                        try {
                                          const parsed = JSON.parse(decodedText);
                                          if (parsed.id) scannedId = parsed.id;
                                          if (parsed.fw || parsed.firmware || parsed.firmware_version) {
                                            scannedFw = parsed.fw || parsed.firmware || parsed.firmware_version;
                                          }
                                        } catch (e) {
                                          if (decodedText.includes('|')) {
                                            const parts = decodedText.split('|');
                                            scannedId = parts[0];
                                            if (parts.length > 1) scannedFw = parts[1];
                                          } else if (decodedText.includes(',')) {
                                            const parts = decodedText.split(',');
                                            scannedId = parts[0];
                                            if (parts.length > 1) scannedFw = parts[1];
                                          }
                                        }

                                        setFormData(prev => ({
                                          ...prev,
                                          id: scannedId,
                                          ...(scannedFw ? { firmware_version: scannedFw } : {})
                                        }));
                                        toast.success(`QR Code terdeteksi: ${scannedId}${scannedFw ? ` (FW: ${scannedFw})` : ''}`);
                                        scanner.stop().catch(() => { });
                                        setIsQrScannerOpen(false);
                                      },
                                      () => { }
                                    );
                                  } catch (err) {
                                    toast.error('Gagal membuka kamera. Pastikan izin kamera aktif.');
                                  }
                                }}
                              >
                                <Camera size={14} /> Buka Kamera
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2 text-xs flex-1 rounded-lg"
                                onClick={() => qrFileInputRef.current?.click()}
                              >
                                <Upload size={14} /> Upload Gambar
                              </Button>
                              <input
                                ref={qrFileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    const scanner = new Html5Qrcode('qr-reader-node');
                                    const result = await scanner.scanFile(file, true);
                                    
                                    let scannedId = result;
                                    let scannedFw = '';
                                    try {
                                      const parsed = JSON.parse(result);
                                      if (parsed.id) scannedId = parsed.id;
                                      if (parsed.fw || parsed.firmware || parsed.firmware_version) {
                                        scannedFw = parsed.fw || parsed.firmware || parsed.firmware_version;
                                      }
                                    } catch (err) {
                                      if (result.includes('|')) {
                                        const parts = result.split('|');
                                        scannedId = parts[0];
                                        if (parts.length > 1) scannedFw = parts[1];
                                      } else if (result.includes(',')) {
                                        const parts = result.split(',');
                                        scannedId = parts[0];
                                        if (parts.length > 1) scannedFw = parts[1];
                                      }
                                    }

                                    setFormData(prev => ({
                                      ...prev,
                                      id: scannedId,
                                      ...(scannedFw ? { firmware_version: scannedFw } : {})
                                    }));
                                    toast.success(`QR Code terdeteksi: ${scannedId}${scannedFw ? ` (FW: ${scannedFw})` : ''}`);
                                    setIsQrScannerOpen(false);
                                  } catch {
                                    toast.error('Gagal membaca QR code dari gambar.');
                                  }
                                }}
                              />
                            </div>
                            <div id="qr-reader-node" className="w-full rounded-lg overflow-hidden" />
                            <p className="text-[9px] text-muted-foreground text-center">
                              Arahkan kamera ke QR Code pada perangkat atau unggah foto QR Code
                            </p>
                          </div>
                        )}
                      </div>
                      {/* Field Nama Alias Node dihapus sesuai permintaan */}
                      <div className="grid gap-1.5">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase opacity-70">Versi Firmware</Label>
                        <Input
                          placeholder="V 1.0.0"
                          value={formData.firmware_version}
                          className="h-10 rounded-xl bg-muted/20 border-border/50 focus:bg-background transition-all text-xs font-bold"
                          onChange={e => setFormData({ ...formData, firmware_version: e.target.value })}
                        />
                      </div>

                      {/* Node Status Indicator - Simple Text */}
                      <div className="flex items-center gap-2 pt-1 px-1">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Status:</Label>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.1em]">Offline</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-muted/30 border-t border-border/50 mt-auto">
                  <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="w-full h-12 gap-2 rounded-xl text-sm font-bold shadow-xl shadow-primary/20">
                    <Save size={18} /> {isSubmitting ? 'Menyimpan...' : (editingNode ? 'Simpan Perubahan Node' : 'Daftarkan Node Sekarang')}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col gap-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Perangkat</span>
          <span className="text-2xl font-black">{nodes.length}</span>
        </div>
        <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col gap-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Aktif</span>
          <span className="text-2xl font-black">{nodes.filter(n => n.status === 'online').length}</span>
        </div>
        <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col gap-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Peringatan</span>
          <span className="text-2xl font-black">{nodes.filter(n => n.status === 'warning').length}</span>
        </div>
        <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col gap-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tidak Aktif</span>
          <span className="text-2xl font-black">{nodes.filter(n => n.status === 'offline').length}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-3 rounded-lg shadow-sm border border-border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Cari ID atau Nama Node..."
            className="pl-10 bg-muted/50 border-none h-11"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={18} className="text-muted-foreground shrink-0" />
          <Select value={nodeFilter} onValueChange={(v) => setNodeFilter(v || 'all')}>
            <SelectTrigger className="w-full sm:w-[200px] h-11 bg-muted/50 border-none">
              <SelectValue placeholder="Pilih Node" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Node</SelectItem>
              {nodes.map(node => (
                <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || 'all')}>
            <SelectTrigger className="w-full sm:w-[160px] h-11 bg-muted/50 border-none">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-none shadow-sm shadow-black/5 overflow-hidden">
        <NodeTable
          nodes={filteredNodes}
          onEdit={handleOpenEdit}
          onDelete={(dbId) => {
            setNodeToDelete(dbId);
            setIsDeleteDialogOpen(true);
          }}
          userRole={userRole}
        />
      </Card>

      {/* Global Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!isSubmitting) setIsDeleteDialogOpen(open); }}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Hapus Perangkat?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Tindakan ini tidak dapat dibatalkan. Seluruh data historis dari perangkat ini akan hilang secara permanen dari sistem AgriSense.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-border bg-muted/20 font-bold" disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (nodeToDelete && !isSubmitting) handleDelete(nodeToDelete);
              }}
              disabled={isSubmitting}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold px-8 shadow-lg shadow-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Menghapus..." : "Hapus Selamanya"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

