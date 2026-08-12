import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import { IoTNode, User, UserRole, normalizeNode, mockLandPlots, mockGardens, formatEYDDeviceName } from '../lib/mockData';
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

export default function NodesView({ nodes: propNodes, userRole }: { nodes?: IoTNode[], userRole?: string }) {
  const { t } = useTranslation();
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
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      if (Array.isArray(data)) {
        setNodes(data.map(normalizeNode));
      }
    } catch (e) {
      console.error('Failed to fetch nodes', e);
    }
  }, []);

  const fetchLandPlots = useCallback(async () => {
    try {
      const res = await api.get('/land-plots');
      const rawData = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.land_plots || []);

      let dataToFormat = Array.isArray(rawData) && rawData.length > 0 ? rawData : mockLandPlots;

      const formatted = dataToFormat.map((d: any) => {
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
          name: d.plot_name || d.name || d.plot_code || `Lahan #${d.id}`,
          polygon: polygonData,
          latitude: d.latitude,
          longitude: d.longitude
        };
      });
      setLandPlots(formatted);
    } catch (e) {
      console.error('Failed to fetch land plots, using fallback', e);
      if (mockLandPlots && mockLandPlots.length > 0) {
        setLandPlots(mockLandPlots.map((d: any) => ({
          id: String(d.id),
          name: d.plot_name || d.name || d.plot_code || `Lahan #${d.id}`,
          polygon: d.polygon || [],
          latitude: d.latitude,
          longitude: d.longitude
        })));
      }
    }
  }, []);

  const fetchGardens = useCallback(async () => {
    try {
      const res = await api.get('/gardens');
      const rawData = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.gardens || []);
      let dataToSet = Array.isArray(rawData) && rawData.length > 0 ? rawData : mockGardens;
      setGardens(dataToSet);
    } catch (e) {
      console.error('Failed to fetch gardens, using fallback', e);
      if (mockGardens && mockGardens.length > 0) {
        setGardens(mockGardens);
      }
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
    fetchLandPlots();
    fetchGardens();
    setIsDialogOpen(true);
  };
  const handleOpenEdit = (node: IoTNode) => {
    fetchLandPlots();
    fetchGardens();
    setEditingNode(node);
    const rawCode = (node as any).device_code || (node as any).code || node.id;
    setFormData({
      id: String(rawCode),
      name: node.name,
      location: node.location,
      latitude: node.coords?.[0]?.toString() || (node as any).latitude?.toString() || '-6.831500',
      longitude: node.coords?.[1]?.toString() || (node as any).longitude?.toString() || '107.916000',
      altitude: node.altitude?.toString() || '720',
      lahanId: String(node.lahanId || (node as any).lahan_id || ''),
      gardenId: String(node.gardenId || (node as any).garden_id || ''),
      firmware_version: node.firmware_version || 'V 1.0.0'
    });

    // Fallback safe coordinates
    const lat = node.coords?.[0] ? Number(node.coords[0]) : ((node as any).latitude ? Number((node as any).latitude) : -6.8315);
    const lng = node.coords?.[1] ? Number(node.coords[1]) : ((node as any).longitude ? Number((node as any).longitude) : 107.9160);

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
      setNodes(prev => prev.filter(n => (n as any).db_id !== db_id && n.id !== String(db_id)));
      window.dispatchEvent(new CustomEvent('nodes:updated'));
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
    const serialCode = formData.id.trim();
    if (!serialCode) {
      toast.error('Gagal: Kode / Nomor Seri Perangkat wajib diisi!');
      return;
    }

    setIsSubmitting(true);
    try {
      const eydName = formatEYDDeviceName(formData.name || `Perangkat ${serialCode}`, serialCode);

      const payload = {
        id: serialCode,
        device_code: serialCode,
        code: serialCode,
        name: eydName,
        location: formData.location || 'Subang',
        latitude: parseFloat(formData.latitude) || -6.8315,
        longitude: parseFloat(formData.longitude) || 107.9160,
        altitude: parseFloat(formData.altitude) || 720,
        lahanId: formData.lahanId || null,
        lahan_id: formData.lahanId || null,
        gardenId: formData.gardenId || null,
        garden_id: formData.gardenId || null,
        firmware_version: formData.firmware_version
      };

      const url = editingNode
        ? `/nodes/${(editingNode as any).db_id || editingNode.id}`
        : '/nodes';

      if (editingNode) {
        await api.put(url, payload);
      } else {
        await api.post(url, payload);
      }

      // Update local state nodes immediately for instant UI responsiveness
      setNodes(prevNodes => {
        if (editingNode) {
          return prevNodes.map(n => {
            if (n.id === editingNode.id || (n as any).db_id === (editingNode as any).db_id) {
              return {
                ...n,
                id: serialCode,
                device_code: serialCode,
                code: serialCode,
                name: eydName,
                location: formData.location || 'Subang',
                coords: [parseFloat(formData.latitude) || -6.8315, parseFloat(formData.longitude) || 107.9160],
                latitude: parseFloat(formData.latitude) || -6.8315,
                longitude: parseFloat(formData.longitude) || 107.9160,
                altitude: parseFloat(formData.altitude) || 720,
                lahanId: formData.lahanId ? Number(formData.lahanId) : undefined,
                gardenId: formData.gardenId ? Number(formData.gardenId) : undefined,
                firmware_version: formData.firmware_version
              } as IoTNode;
            }
            return n;
          });
        } else {
          const newNode: IoTNode = {
            id: serialCode,
            device_code: serialCode,
            db_id: Date.now(),
            name: eydName,
            location: formData.location || 'Subang',
            status: 'online',
            coords: [parseFloat(formData.latitude) || -6.8315, parseFloat(formData.longitude) || 107.9160],
            altitude: parseFloat(formData.altitude) || 720,
            battery_percent: 100,
            battery_voltage: 4.2,
            lahanId: formData.lahanId ? Number(formData.lahanId) : undefined,
            gardenId: formData.gardenId ? Number(formData.gardenId) : undefined,
            firmware_version: formData.firmware_version
          } as any;
          return [newNode, ...prevNodes];
        }
      });

      toast.success(editingNode ? "Kode / Nomor Seri Perangkat berhasil diperbarui!" : "Perangkat baru berhasil didaftarkan!");
      window.dispatchEvent(new CustomEvent('nodes:updated'));
      fetchNodes();
      setIsDialogOpen(false);
      resetForm();
    } catch (e: any) {
      console.error("Save Exception:", e);
      let msg = e.response?.data?.message || e.message;
      if (e.response?.status === 422 && e.response?.data?.errors) {
        msg = Object.values(e.response.data.errors).flat().join('\n');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs shrink-0">
            <Radio size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">{t("Manajemen Perangkat")}</h1>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {t("Kelola registrasi node IoT, lokasi geografis GIS, dan status telemetri perangkat.")}
            </p>
          </div>
        </div>
        {userRole !== 'viewer' && (
          <Button className="gap-2 h-11 px-6 rounded-2xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-all cursor-pointer" onClick={handleOpenAdd}>
            <Plus size={18} /> {t("Tambah Node Baru")}
          </Button>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (isSubmitting) return;
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="sm:max-w-[1150px] w-[92vw] p-0 overflow-hidden rounded-[28px] border border-border/80 shadow-2xl max-h-[92vh] flex flex-col bg-card">
            {/* ── Dialog Header Bar ── */}
            <DialogHeader className="p-6 sm:p-7 pb-5 border-b border-border/60 bg-muted/20 flex flex-row items-start gap-4 space-y-0 text-left shrink-0">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 shadow-xs">
                <Radio size={22} />
              </div>
              <div className="flex flex-col gap-1 pr-8">
                <DialogTitle className="text-xl font-black tracking-tight text-foreground leading-snug">
                  {editingNode ? t('Edit Perangkat IoT') : t('Daftarkan Perangkat Baru')}
                </DialogTitle>
                <DialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
                  {t('Tentukan lokasi perangkat pada peta GIS dan lengkapi identitas node telemetri.')}
                </DialogDescription>
              </div>
            </DialogHeader>

            {/* ── Main Split View Body ── */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto lg:overflow-hidden min-h-[440px]">
              {/* ── LEFT: MAP PANEL (7 Cols) ── */}
              <div className="lg:col-span-7 relative bg-muted/10 h-full min-h-[380px]">
                {/* Petunjuk Penggunaan Map */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-card/90 backdrop-blur-md px-4 py-2 rounded-full border border-border/80 shadow-md pointer-events-none whitespace-nowrap">
                  <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <MapPin size={12} className="text-emerald-600" />
                    {t('Klik pada peta untuk menentukan koordinat perangkat')}
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
                      altitude: t('Memuat...')
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
                    className="h-10 shadow-lg gap-2 text-xs font-black px-4 rounded-xl border border-border/80 bg-card hover:bg-muted transition-all cursor-pointer"
                    onClick={handleGetCurrentLocation}
                  >
                    <MapPin size={14} className="text-emerald-600" /> {t('Lokasi Saya')}
                  </Button>
                </div>
              </div>

              {/* ── RIGHT: FORM PANEL (5 Cols) ── */}
              <div className="lg:col-span-5 flex flex-col bg-card border-l border-border/60 h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Penempatan dan Lokasi */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                      {t('Penempatan dan Lokasi')}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block mb-2">
                          {t('Pilih Lahan')}
                        </Label>
                        <select
                          value={formData.lahanId}
                          onChange={(e) => {
                            const val = e.target.value;
                            const lahan = landPlots.find(l => String(l.id) === val);
                            if (lahan && lahan.polygon && Array.isArray(lahan.polygon)) {
                              try {
                                const validBounds = lahan.polygon
                                  .filter((c: any) => Array.isArray(c) && c.length >= 2)
                                  .map((c: any) => [Number(c[1]), Number(c[0])])
                                  .filter((c: any) => !isNaN(c[0]) && !isNaN(c[1]));
                                if (validBounds.length > 0) setMapBounds(validBounds);
                              } catch (err) {
                                console.error("Error setting map bounds for lahan", err);
                              }
                            }
                            setFormData(prev => ({
                              ...prev,
                              lahanId: val || '',
                              gardenId: '',
                              location: lahan?.name || prev.location
                            }));
                          }}
                          className="w-full rounded-2xl h-11 px-4 border border-border/80 bg-muted/20 font-semibold text-xs text-foreground focus:bg-background focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-xs cursor-pointer"
                        >
                          <option value="" className="bg-background text-foreground">-- {t("Pilih Lahan Utama")} --</option>
                          {landPlots.map(lahan => (
                            <option key={lahan.id} value={String(lahan.id)} className="font-bold py-2 text-xs uppercase bg-background text-foreground">
                              {lahan.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block mb-2">
                          {t('Pilih Kebun (Sub-Lahan)')}
                        </Label>
                        <select
                          disabled={!formData.lahanId}
                          value={formData.gardenId}
                          onChange={(e) => {
                            const val = e.target.value;
                            const garden = gardens.find(g => String(g.id) === val);
                            if (garden && garden.polygon) {
                              try {
                                const poly = typeof garden.polygon === 'string' ? JSON.parse(garden.polygon) : garden.polygon;
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
                              } catch (err) {
                                console.error("Error setting map bounds for garden", err);
                              }
                            }
                            setFormData(prev => ({
                              ...prev,
                              gardenId: val || '',
                              location: garden?.garden_name || prev.location
                            }));
                          }}
                          className="w-full rounded-2xl h-11 px-4 border border-border/80 bg-muted/20 font-semibold text-xs text-foreground focus:bg-background focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="" className="bg-background text-foreground">-- {t("Pilih Kebun (Sub-Lahan)")} --</option>
                          {gardens
                            .filter(g => String(g.land_plot_id || g.lahanId || g.lahan_id) === String(formData.lahanId))
                            .map(garden => (
                              <option key={garden.id} value={String(garden.id)} className="font-bold py-2 text-xs uppercase bg-background text-foreground">
                                {garden.garden_name} {garden.plant?.name ? `(${garden.plant.name})` : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Identitas Perangkat */}
                  <div className="space-y-4 pt-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                      {t('Identitas Perangkat')}
                    </p>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                          {t('Nama Perangkat')} <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          placeholder="Contoh: NODE Kebun Subang Blok A"
                          value={formData.name}
                          className="w-full rounded-2xl h-11 px-4 border-border/80 bg-muted/20 font-semibold text-xs focus:bg-background focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-xs"
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                          {t('Kode / Nomor Seri (RH)')} <span className="text-rose-500">*</span>
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="RH-001"
                            value={formData.id}
                            className="w-full rounded-2xl h-11 px-4 border-border/80 bg-muted/20 font-semibold text-xs focus:bg-background focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-xs flex-1"
                            onChange={e => setFormData({ ...formData, id: e.target.value })}
                          />
                          {!editingNode && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-11 w-11 rounded-2xl border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 cursor-pointer transition-all"
                              title={t('Scan QR Code')}
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
                              <QrCode size={18} />
                            </Button>
                          )}
                        </div>

                        {/* QR Scanner Panel */}
                        {isQrScannerOpen && !editingNode && (
                          <div className="mt-2 p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-3">
                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                              {t('Scan QR Code Perangkat')}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2 text-xs flex-1 rounded-xl font-bold"
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
                                <Camera size={14} /> {t('Buka Kamera')}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2 text-xs flex-1 rounded-xl font-bold"
                                onClick={() => qrFileInputRef.current?.click()}
                              >
                                <Upload size={14} /> {t('Upload Gambar')}
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
                            <div id="qr-reader-node" className="w-full rounded-xl overflow-hidden" />
                          </div>
                        )}
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                          {t('Versi Firmware')}
                        </Label>
                        <Input
                          placeholder="V 1.0.0"
                          value={formData.firmware_version}
                          className="w-full rounded-2xl h-11 px-4 border-border/80 bg-muted/20 font-semibold text-xs focus:bg-background focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-xs"
                          onChange={e => setFormData({ ...formData, firmware_version: e.target.value })}
                        />
                      </div>

                      {editingNode && (
                        <div className="flex items-center gap-3 pt-2 px-1">
                          <Label className="text-xs font-black text-muted-foreground uppercase opacity-70">{t('Status')}:</Label>
                          {(() => {
                            const st = (editingNode.status || '').toString().toLowerCase();
                            const isOnline = st === 'online' || st === 'aktif';
                            const isWarning = st === 'warning' || st === 'peringatan';
                            return (
                              <Badge className={cn(
                                "text-xs font-extrabold px-3 py-1 rounded-full border flex items-center gap-1.5 shadow-xs",
                                isOnline 
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                                  : isWarning
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
                                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40"
                              )}>
                                <span className={cn(
                                  "w-2 h-2 rounded-full shrink-0",
                                  isOnline ? "bg-emerald-500 animate-pulse" : isWarning ? "bg-amber-500 animate-pulse" : "bg-rose-500"
                                )} />
                                {isOnline ? t('Aktif') : isWarning ? t('Peringatan') : t('Tidak Aktif')}
                              </Badge>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Full-Width Dialog Footer ── */}
            <DialogFooter className="px-6 py-4 sm:px-8 sm:py-5 border-t border-border/60 bg-muted/30 flex flex-row items-center justify-end gap-3 shrink-0 rounded-b-[28px] space-x-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="h-11 px-6 rounded-2xl border-border/80 font-extrabold text-xs bg-card hover:bg-muted transition-all cursor-pointer m-0"
              >
                {t('Batal')}
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="h-11 px-7 rounded-2xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-all cursor-pointer gap-2 m-0"
              >
                <Save size={16} />
                {isSubmitting ? t('Menyimpan...') : editingNode ? t('Simpan Perubahan Node') : t('Daftarkan Node Sekarang')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">{t("Total Perangkat")}</span>
            <span className="text-3xl font-black tracking-tight text-foreground">{nodes.length}</span>
            <span className="text-[11px] font-semibold text-muted-foreground">{t("Node IoT Terintegrasi")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <Radio size={24} />
          </div>
        </div>

        <div className="bg-card p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t("Aktif")}</span>
            <span className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">{nodes.filter(n => n.status === 'online').length}</span>
            <span className="text-[11px] font-semibold text-emerald-700/80 dark:text-emerald-400/80">{t("Koneksi Telemetri Normal")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="bg-card p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider">{t("Peringatan")}</span>
            <span className="text-3xl font-black tracking-tight text-amber-600 dark:text-amber-400">{nodes.filter(n => n.status === 'warning').length}</span>
            <span className="text-[11px] font-semibold text-amber-700/80 dark:text-amber-400/80">{t("Baterai dan Sinyal Lemah")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
            <AlertTriangle size={24} />
          </div>
        </div>

        <div className="bg-card p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider">{t("Tidak Aktif")}</span>
            <span className="text-3xl font-black tracking-tight text-rose-600 dark:text-rose-400">{nodes.filter(n => n.status === 'offline').length}</span>
            <span className="text-[11px] font-semibold text-rose-700/80 dark:text-rose-400/80">{t("Terputus dari Jaringan")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 group-hover:scale-105 transition-transform">
            <Zap size={24} />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-2xl shadow-sm border border-border/80">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder={t("Cari ID atau Nama Node...")}
            className="pl-10 bg-muted/20 border-border/60 focus:bg-background h-11 rounded-2xl font-semibold text-xs transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={18} className="text-muted-foreground shrink-0" />
          <select
            value={nodeFilter}
            onChange={(e) => setNodeFilter(e.target.value || 'all')}
            className="w-full sm:w-[220px] h-11 bg-muted/20 border border-border/60 focus:bg-background rounded-2xl font-bold text-xs px-3.5 outline-none cursor-pointer text-foreground"
          >
            <option value="all" className="font-bold text-xs bg-card text-foreground">{t("Semua Perangkat")}</option>
            {nodes.map(node => (
              <option key={node.id} value={node.id} className="font-bold text-xs bg-card text-foreground">
                {formatEYDDeviceName(node.name, node.device_code || node.id)}
              </option>
            ))}
          </select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || 'all')}>
            <SelectTrigger className="w-full sm:w-[160px] h-11 bg-muted/20 border-border/60 focus:bg-background rounded-2xl font-bold text-xs">
              <SelectValue>
                {statusFilter === 'all' ? t('Semua Status') : statusFilter === 'online' ? t('Aktif') : statusFilter === 'warning' ? t('Peringatan') : t('Tidak Aktif')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/80 shadow-2xl">
              <SelectItem value="all" className="font-bold text-xs">{t("Semua Status")}</SelectItem>
              <SelectItem value="online" className="font-bold text-xs">{t("Aktif")}</SelectItem>
              <SelectItem value="warning" className="font-bold text-xs">{t("Peringatan")}</SelectItem>
              <SelectItem value="offline" className="font-bold text-xs">{t("Tidak Aktif")}</SelectItem>
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
        <AlertDialogContent className="sm:max-w-[460px] rounded-[28px] border border-border/80 shadow-2xl p-6 sm:p-7 bg-card gap-0 overflow-hidden">
          <AlertDialogHeader className="flex flex-row items-start gap-4 pb-5 mb-5 border-b border-border/60 space-y-0 text-left">
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0 shadow-xs">
              <Trash2 size={22} />
            </div>
            <div className="flex flex-col gap-1 pr-6">
              <AlertDialogTitle className="text-xl font-black tracking-tight text-foreground leading-snug">
                Hapus Perangkat?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
                Tindakan ini tidak dapat dibatalkan. Seluruh data historis dari perangkat ini akan hilang secara permanen dari sistem AgriSense.
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
                if (nodeToDelete && !isSubmitting) handleDelete(nodeToDelete);
              }}
              disabled={isSubmitting}
              className="h-11 px-7 rounded-2xl font-black text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 transition-all cursor-pointer m-0"
            >
              {isSubmitting ? "Menghapus..." : "Hapus Selamanya"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

