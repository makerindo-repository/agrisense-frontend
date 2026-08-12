import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, MapPin, Trees, Sprout } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import api from '../../lib/api';
import { reverseGeocode } from '../../utils/geolocation';
import { generateUniqueCode } from '../../utils/generators';
import { useTranslation } from 'react-i18next';
import LeafletDrawMap, { PolygonDrawResult } from '../LeafletDrawMap';

import { LandPlot, Garden, mockLandPlots, mockGardens } from '../../lib/mockData';

export interface AreaFormModalProps {
  isOpen: boolean;
  onOpenChange: (val: boolean) => void;
  activeTab: 'lahan' | 'kebun' | 'tanaman';
  editingLand: LandPlot | null;
  editingGarden: Garden | null;
  editingPlanting: any | null;
  landPlots: any[];
  gardens: any[];
  nodes: any[];
  komoditiList: any[];
  onSaveSuccess: () => void;
}

const emptyLandForm = {
  plot_code: '',
  plot_name: '',
  owner_name: '',
  address: '',
  plant_types: '',
  keterangan: '',
  latitude: 0,
  longitude: 0,
  area_hectare: 0,
  polygon: null as any,
  color: '',
};

const emptyGardenForm = {
  land_plot_id: 0,
  garden_code: '',
  garden_name: '',
  soil_type: '',
  latitude: 0,
  longitude: 0,
  area_hectare: 0,
  polygon: null as any,
  keterangan: '',
  color: '',
  kondisi_sekitar: '',
  radius_konteks_m: 60,
  jarak_jalan_m: null as number | null,
};

const emptyPlantingForm = {
  nama_tanaman: '',
  land_plot_id: 0,
  garden_id: 0,
  komoditi_id: 0,
  device_id: 0,
  tanggal_tanam: '',
  estimasi_panen: '',
  status_fase: 'Persiapan',
  is_active: true,
};

export default function AreaFormModal({
  isOpen,
  onOpenChange,
  activeTab,
  editingLand,
  editingGarden,
  editingPlanting,
  landPlots,
  gardens,
  nodes,
  komoditiList,
  onSaveSuccess,
}: AreaFormModalProps) {
  const { t } = useTranslation();
  const [landForm, setLandForm] = useState(emptyLandForm);
  const [gardenForm, setGardenForm] = useState(emptyGardenForm);
  const [plantingForm, setPlantingForm] = useState(emptyPlantingForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(komoditiList.map(k => k.kategori_tanaman)));
  }, [komoditiList]);

  const filteredKomoditi = useMemo(() => {
    return komoditiList.filter(k => k.kategori_tanaman === selectedCategory && k.status === 'Aktif');
  }, [komoditiList, selectedCategory]);

  const effectiveLandPlots = useMemo(() => {
    return Array.isArray(landPlots) && landPlots.length > 0 ? landPlots : mockLandPlots;
  }, [landPlots]);

  const effectiveGardens = useMemo(() => {
    return Array.isArray(gardens) && gardens.length > 0 ? gardens : mockGardens;
  }, [gardens]);

  const filteredGardensForPlanting = useMemo(() => {
    if (!plantingForm.land_plot_id) return effectiveGardens;
    return effectiveGardens.filter(g => Number(g.land_plot_id || g.lahanId || g.lahan_id) === Number(plantingForm.land_plot_id));
  }, [effectiveGardens, plantingForm.land_plot_id]);

  const selectedParentPolygon = useMemo(() => {
    if (activeTab === 'kebun' && gardenForm.land_plot_id) {
      const parent = effectiveLandPlots.find(l => Number(l.id) === Number(gardenForm.land_plot_id));
      return parent?.polygon;
    }
    return null;
  }, [activeTab, gardenForm.land_plot_id, effectiveLandPlots]);

  const selectedParentColor = useMemo(() => {
    if (activeTab === 'kebun' && gardenForm.land_plot_id) {
      const parent = landPlots.find(l => l.id === gardenForm.land_plot_id);
      return parent?.color || '#3b82f6';
    }
    return '#3b82f6';
  }, [activeTab, gardenForm.land_plot_id, landPlots]);

  const siblingGardens = useMemo(() => {
    if (activeTab === 'kebun' && gardenForm.land_plot_id) {
      return gardens.filter(g => g.land_plot_id === gardenForm.land_plot_id && g.id !== editingGarden?.id);
    }
    return [];
  }, [activeTab, gardenForm.land_plot_id, gardens, editingGarden]);

  const searchablePlots = useMemo(() => {
    const lands = (landPlots || []).map(l => ({ id: l.id, name: l.plot_name, code: l.plot_code, latitude: l.latitude, longitude: l.longitude, polygon: l.polygon }));
    const kbns = (gardens || []).map(g => ({ id: g.id, name: g.garden_name, code: g.garden_code, latitude: g.latitude, longitude: g.longitude, polygon: g.polygon }));
    return [...lands, ...kbns];
  }, [landPlots, gardens]);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'lahan') {
        if (editingLand) {
          api.get(`/land-plots/${editingLand.id}`).then((res: any) => {
            const fullData = res.data.data || res.data;
            setLandForm({
              plot_code: fullData.plot_code || '',
              plot_name: fullData.plot_name || '',
              owner_name: fullData.owner_name || '',
              address: fullData.address || '',
              plant_types: fullData.plant_types || '',
              keterangan: fullData.keterangan || '',
              latitude: fullData.latitude || 0,
              longitude: fullData.longitude || 0,
              area_hectare: fullData.area_hectare || 0,
              polygon: typeof fullData.polygon === 'string' ? JSON.parse(fullData.polygon) : fullData.polygon,
              color: fullData.color || '',
            });
          }).catch((e: any) => {
            console.error('Gagal mengambil detail lahan:', e);
            setLandForm({
              plot_code: editingLand.plot_code || '',
              plot_name: editingLand.plot_name || '',
              owner_name: editingLand.owner_name || '',
              address: editingLand.address || '',
              plant_types: editingLand.plant_types || '',
              keterangan: (editingLand as any).keterangan || '',
              latitude: (editingLand as any).latitude || 0,
              longitude: (editingLand as any).longitude || 0,
              area_hectare: (editingLand as any).area_hectare || 0,
              polygon: null,
              color: (editingLand as any).color || '',
            });
          });
        } else {
          setLandForm({ ...emptyLandForm, plot_code: generateUniqueCode('LHN') });
        }
      } else if (activeTab === 'kebun') {
        if (editingGarden) {
          api.get(`/gardens/${editingGarden.id}`).then((res: any) => {
            const fullData = res.data.data || res.data;
            setGardenForm({
              land_plot_id: fullData.land_plot_id,
              garden_code: fullData.garden_code || '',
              garden_name: fullData.garden_name || '',
              soil_type: fullData.soil_type || '',
              latitude: fullData.latitude || 0,
              longitude: fullData.longitude || 0,
              area_hectare: fullData.area_hectare || 0,
              polygon: typeof fullData.polygon === 'string' ? JSON.parse(fullData.polygon) : fullData.polygon,
              keterangan: fullData.keterangan || '',
              color: fullData.color || '',
              kondisi_sekitar: fullData.kondisi_sekitar || '',
              radius_konteks_m: fullData.radius_konteks_m || 60,
              jarak_jalan_m: fullData.jarak_jalan_m ?? null,
            });
          }).catch((e: any) => {
            console.error('Gagal mengambil detail kebun:', e);
            setGardenForm({
              land_plot_id: editingGarden.land_plot_id || 0,
              garden_code: editingGarden.garden_code || '',
              garden_name: editingGarden.garden_name || '',
              soil_type: editingGarden.soil_type || '',
              latitude: (editingGarden as any).latitude || 0,
              longitude: (editingGarden as any).longitude || 0,
              area_hectare: (editingGarden as any).area_hectare || 0,
              polygon: (editingGarden as any).polygon,
              keterangan: (editingGarden as any).keterangan || '',
              color: (editingGarden as any).color || '',
              kondisi_sekitar: (editingGarden as any).kondisi_sekitar || '',
              radius_konteks_m: (editingGarden as any).radius_konteks_m || 60,
              jarak_jalan_m: (editingGarden as any).jarak_jalan_m ?? null,
            });
          });
        } else {
          setGardenForm({ ...emptyGardenForm, garden_code: generateUniqueCode('KBN') });
        }
      } else if (activeTab === 'tanaman') {
        if (editingPlanting) {
          api.get(`/plantings/${editingPlanting.id}`).then((res: any) => {
            const fullData = res.data.data || res.data;
            const g = gardens.find(g => g.id === fullData.garden_id);
            setPlantingForm({
              nama_tanaman: fullData.nama_tanaman || '',
              land_plot_id: g ? g.land_plot_id : 0,
              garden_id: fullData.garden_id || 0,
              komoditi_id: fullData.komoditi_id || 0,
              device_id: fullData.device_id || 0,
              tanggal_tanam: fullData.tanggal_tanam || '',
              estimasi_panen: fullData.estimasi_panen || '',
              status_fase: fullData.status_fase || 'Persiapan',
              is_active: fullData.is_active ?? true,
            });

            if (fullData.komoditi) {
              setSelectedCategory(fullData.komoditi.kategori_tanaman);
            } else if (fullData.komoditi_id) {
              const kom = komoditiList.find(k => k.id === fullData.komoditi_id);
              if (kom) setSelectedCategory(kom.kategori_tanaman);
            }
          }).catch((e: any) => {
            console.error('Gagal mengambil detail tanaman:', e);
            const g = gardens.find(g => g.id === editingPlanting.garden_id);
            setPlantingForm({
              nama_tanaman: editingPlanting.nama_tanaman || '',
              land_plot_id: g ? g.land_plot_id : 0,
              garden_id: editingPlanting.garden_id || 0,
              komoditi_id: editingPlanting.komoditi_id || 0,
              device_id: editingPlanting.device_id || 0,
              tanggal_tanam: editingPlanting.tanggal_tanam || '',
              estimasi_panen: editingPlanting.estimasi_panen || '',
              status_fase: editingPlanting.status_fase || 'Persiapan',
              is_active: editingPlanting.is_active ?? true,
            });
            if (editingPlanting.komoditi_id) {
              const kom = komoditiList.find(k => k.id === editingPlanting.komoditi_id);
              if (kom) setSelectedCategory(kom.kategori_tanaman);
            }
          });
        } else {
          setPlantingForm({ ...emptyPlantingForm });
        }
      }
    }
  }, [isOpen, activeTab, editingLand, editingGarden, editingPlanting, komoditiList]);

  const handleSaveLand = async () => {
    if (!landForm.plot_name) {
      toast.error('Nama Lahan wajib diisi!');
      return;
    }
    if (!landForm.polygon) {
      toast.error('Silakan gambar polygon area lahan di peta!');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = !!editingLand;
      const url = isEdit
        ? `/land-plots/${editingLand.id}`
        : '/land-plots';

      if (isEdit) {
        await api.put(url, landForm);
      } else {
        await api.post(url, landForm);
      }

      toast.success(isEdit ? 'Lahan berhasil diperbarui!' : 'Lahan baru berhasil ditambahkan!');
      onSaveSuccess();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      let msg = 'Gagal menyimpan data Lahan.';
      if (e.response?.status === 422 && e.response?.data?.errors) {
        msg = Object.values(e.response.data.errors).flat().join('\\n');
      } else if (e.response?.data?.message) {
        msg = e.response.data.message;
      }
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveGarden = async () => {
    if (!gardenForm.garden_name || !gardenForm.land_plot_id) {
      toast.error('Nama Kebun dan Lahan Induk wajib diisi!');
      return;
    }
    if (!gardenForm.polygon) {
      toast.error('Silakan gambar polygon area kebun di peta!');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = !!editingGarden;
      const url = isEdit
        ? `/gardens/${editingGarden.id}`
        : '/gardens';

      const payload = {
        ...gardenForm,
      };

      if (isEdit) {
        await api.put(url, payload);
      } else {
        await api.post(url, payload);
      }

      toast.success(isEdit ? 'Kebun berhasil diperbarui!' : 'Kebun baru berhasil ditambahkan!');
      onSaveSuccess();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      let msg = 'Gagal menyimpan data Kebun.';
      if (e.response?.status === 422 && e.response?.data?.errors) {
        msg = Object.values(e.response.data.errors).flat().join('\\n');
      } else if (e.response?.data?.message) {
        msg = e.response.data.message;
      }
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePlanting = async () => {
    if (!plantingForm.garden_id || !plantingForm.komoditi_id) {
      toast.error('Lokasi Kebun dan Komoditi Tanaman wajib diisi!');
      return;
    }

    // Auto-generate nama_tanaman if empty before sending to backend
    let finalNamaTanaman = plantingForm.nama_tanaman;
    if (!finalNamaTanaman) {
      const selectedK = komoditiList.find(k => k.id === plantingForm.komoditi_id);
      const selectedG = gardens.find(g => g.id === plantingForm.garden_id);
      const kName = selectedK ? selectedK.nama_komoditi : 'Tanaman';
      const gName = selectedG ? selectedG.garden_name : 'Baru';
      finalNamaTanaman = `${kName} - ${gName} (${new Date().toLocaleString('id-ID', { month: 'short', year: 'numeric' })})`;
    }

    setIsSubmitting(true);
    try {
      const isEdit = !!editingPlanting;
      const url = isEdit
        ? `/plantings/${editingPlanting.id}`
        : '/plantings';

      const payload = {
        ...plantingForm,
        nama_tanaman: finalNamaTanaman,
        komoditi_id: plantingForm.komoditi_id > 0 ? plantingForm.komoditi_id : null,
        device_id: plantingForm.device_id > 0 ? plantingForm.device_id : null,
      };

      if (isEdit) {
        await api.put(url, payload);
      } else {
        await api.post(url, payload);
      }

      toast.success(isEdit ? 'Data Tanaman berhasil diperbarui!' : 'Tanaman baru berhasil ditambahkan!');
      onSaveSuccess();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      let msg = 'Gagal menyimpan data Tanaman.';
      if (e.response?.status === 422 && e.response?.data?.errors) {
        msg = Object.values(e.response.data.errors).flat().join('\\n');
      } else if (e.response?.data?.message) {
        msg = e.response.data.message;
      }
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => { if (!isSubmitting) onOpenChange(val); }}>
      <DialogContent className={cn(
        "sm:max-w-[1150px] p-0 overflow-hidden rounded-[28px] border border-border/80 shadow-2xl max-h-[92vh] flex flex-col bg-card",
        activeTab === 'tanaman' && "sm:max-w-[620px]"
      )}>
        {/* Modal Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={cn(
              "p-3 rounded-2xl border shadow-xs shrink-0",
              activeTab === 'lahan' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
              activeTab === 'kebun' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
              "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
            )}>
              {activeTab === 'lahan' ? <MapPin size={22} /> : activeTab === 'kebun' ? <Trees size={22} /> : <Sprout size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <DialogTitle className="text-lg font-black tracking-tight text-foreground">
                  {activeTab === 'lahan'
                    ? (editingLand ? 'Edit Data Lahan Induk' : 'Tambah Lahan Induk Baru')
                    : activeTab === 'kebun'
                    ? (editingGarden ? 'Edit Data Kebun / Blok' : 'Tambah Kebun / Blok Baru')
                    : (editingPlanting ? 'Edit Data Tanaman Aktif' : 'Tambah Tanaman Aktif Baru')
                  }
                </DialogTitle>
                <Badge variant="secondary" className="font-mono text-[10px] font-bold px-2 py-0.5">
                  {activeTab === 'lahan' ? landForm.plot_code : activeTab === 'kebun' ? gardenForm.garden_code : 'TANAMAN'}
                </Badge>
              </div>
              <DialogDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                {activeTab === 'lahan'
                  ? 'Gambar poligon batas lahan di peta kiri, lalu lengkapi informasi lahan di sebelah kanan.'
                  : activeTab === 'kebun'
                  ? 'Pilih Lahan Induk, lalu gambar blok zonasi kebun di dalam area lahan tersebut.'
                  : 'Isi formulir untuk mendaftarkan tanaman yang sedang aktif dipantau.'
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Main Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* ── LEFT: GIS MAP VIEWPORT (50%) ── */}
          {activeTab !== 'tanaman' && (
            <div className="w-full lg:w-[50%] relative bg-slate-950 min-h-[320px] flex flex-col justify-between">
              {/* Floating Map Top Hint */}
              <div className="absolute top-3 left-16 right-3 z-[400] pointer-events-none">
                <div className="bg-slate-900/90 backdrop-blur-md text-white border border-white/15 rounded-xl px-3.5 py-1.5 flex items-center gap-2 text-[11px] font-bold shadow-xl">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="truncate">{t('Petunjuk: Gunakan toolbar di kiri peta untuk menggambar atau mengedit poligon')}</span>
                </div>
              </div>

              {activeTab === 'lahan' ? (
                <LeafletDrawMap
                  height="100%"
                  existingPolygon={landForm.polygon}
                  drawColor="#3B82F6"
                  onPolygonChange={async (res: PolygonDrawResult | null) => {
                    if (res) {
                      setLandForm(prev => ({
                        ...prev,
                        polygon: res.polygon,
                        latitude: res.latitude,
                        longitude: res.longitude,
                        area_hectare: res.area_hectare,
                        color: '#3B82F6',
                      }));
                      if (res.latitude && res.longitude) {
                        const addr = await reverseGeocode(res.latitude, res.longitude);
                        if (addr) setLandForm(prev => ({ ...prev, address: addr }));
                      }
                    } else {
                      setLandForm(prev => ({ ...prev, polygon: null, area_hectare: 0, latitude: 0, longitude: 0 }));
                    }
                  }}
                >
                  <div className="absolute bottom-4 left-4 z-[400] bg-card/95 backdrop-blur-md p-3 rounded-2xl border border-border/80 shadow-2xl flex flex-col gap-1 text-[11px] font-bold min-w-[170px] text-foreground">
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-muted-foreground uppercase text-[9px]">Luas Area</span>
                      <span className="text-blue-600 dark:text-blue-400 font-black">{Number(landForm.area_hectare || 0).toFixed(2)} Ha</span>
                    </div>
                    <div className="flex justify-between items-center gap-4 border-t border-border/40 pt-1">
                      <span className="text-muted-foreground uppercase text-[9px]">Latitude</span>
                      <span className="font-mono text-foreground">{Number(landForm.latitude || 0).toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-muted-foreground uppercase text-[9px]">Longitude</span>
                      <span className="font-mono text-foreground">{Number(landForm.longitude || 0).toFixed(6)}</span>
                    </div>
                  </div>
                </LeafletDrawMap>
              ) : (
                <LeafletDrawMap
                  height="100%"
                  existingPolygon={gardenForm.polygon}
                  parentLandPolygon={selectedParentPolygon}
                  parentLandColor="#3B82F6"
                  existingGardens={siblingGardens}
                  drawColor="#10B981"
                  onPolygonChange={async (res: PolygonDrawResult | null) => {
                    if (res) {
                      setGardenForm(prev => ({
                        ...prev,
                        polygon: res.polygon,
                        latitude: res.latitude,
                        longitude: res.longitude,
                        area_hectare: res.area_hectare,
                        color: '#10B981',
                      }));
                    } else {
                      setGardenForm(prev => ({ ...prev, polygon: null, area_hectare: 0, latitude: 0, longitude: 0 }));
                    }
                  }}
                >
                  <div className="absolute bottom-4 left-4 z-[400] bg-card/95 backdrop-blur-md p-3 rounded-2xl border border-border/80 shadow-2xl flex flex-col gap-1 text-[11px] font-bold min-w-[170px] text-foreground">
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-muted-foreground uppercase text-[9px]">Luas Blok</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">{Number(gardenForm.area_hectare || 0).toFixed(2)} Ha</span>
                    </div>
                    <div className="flex justify-between items-center gap-4 border-t border-border/40 pt-1">
                      <span className="text-muted-foreground uppercase text-[9px]">Latitude</span>
                      <span className="font-mono text-foreground">{Number(gardenForm.latitude || 0).toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-muted-foreground uppercase text-[9px]">Longitude</span>
                      <span className="font-mono text-foreground">{Number(gardenForm.longitude || 0).toFixed(6)}</span>
                    </div>
                  </div>
                </LeafletDrawMap>
              )}
            </div>
          )}

          {/* ── RIGHT: FORM FIELDS (50% or 100%) ── */}
          <div className={cn("overflow-y-auto p-6 space-y-4 bg-card border-l border-border/60", activeTab === 'tanaman' ? 'w-full' : 'w-full lg:w-[50%]')}>
            {activeTab === 'lahan' ? (
              <>
                <div className="space-y-1.5">
                  <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">Nama Lahan <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Contoh: Lahan Subang Sektor Utara"
                    value={landForm.plot_name}
                    onChange={e => setLandForm({ ...landForm, plot_name: e.target.value })}
                    className="rounded-2xl h-11 border-border/80 font-semibold text-xs px-3.5 bg-card shadow-xs focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">{t('Pemilik / Penanggung Jawab Lahan')}</Label>
                  <Input
                    placeholder="Contoh: Bpk. Ahmad Hidayat"
                    value={landForm.owner_name}
                    onChange={e => setLandForm({ ...landForm, owner_name: e.target.value })}
                    className="rounded-2xl h-11 border-border/80 font-semibold text-xs px-3.5 bg-card shadow-xs focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">{t('Alamat Lengkap')}</Label>
                  <Input
                    placeholder="Alamat akan terisi otomatis dari koordinat lokasi peta"
                    value={landForm.address}
                    onChange={e => setLandForm({ ...landForm, address: e.target.value })}
                    className="rounded-2xl h-11 border-border/80 font-semibold text-xs px-3.5 bg-card shadow-xs focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between text-xs font-extrabold text-blue-600 dark:text-blue-400">
                  <span className="uppercase tracking-wider text-[10px]">Warna Poligon Lahan</span>
                  <span className="flex items-center gap-2 font-bold text-xs text-foreground">
                    <span className="w-3.5 h-3.5 rounded-full bg-blue-500 border border-white shadow-xs" />
                    Biru Sistem (#3B82F6)
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">{t('Keterangan / Catatan Lahan')}</Label>
                  <textarea
                    placeholder="Contoh: Lahan irigasi teknis dekat sungai utama"
                    value={landForm.keterangan || ''}
                    onChange={e => setLandForm({ ...landForm, keterangan: e.target.value })}
                    className="w-full min-h-[85px] rounded-2xl border border-border/80 bg-card px-3.5 py-2.5 font-medium text-xs resize-none outline-none focus:ring-2 focus:ring-blue-500/40"
                    rows={3}
                  />
                </div>

                {!editingLand && (
                  <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-900 dark:text-blue-300 space-y-1">
                    <p className="font-extrabold flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                      💡 {t('Petunjuk Pemetaan Lahan')}
                    </p>
                    <ul className="list-disc pl-4 text-[11px] space-y-0.5 opacity-90">
                      <li>{t('Gambar poligon area lahan pada viewport peta di sebelah kiri (Warna Biru).')}</li>
                      <li>{t('Alamat akan terisi otomatis berdasarkan hasil reverse geocoding lokasi.')}</li>
                      <li>{t('Setelah lahan disimpan, Anda dapat membagi lahan menjadi beberapa Blok Kebun.')}</li>
                    </ul>
                  </div>
                )}
              </>
            ) : activeTab === 'kebun' ? (
              <>
                <div className="space-y-1.5">
                  <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">Lahan Induk <span className="text-destructive">*</span></Label>
                  <select
                    value={gardenForm.land_plot_id ? gardenForm.land_plot_id.toString() : ''}
                    onChange={e => setGardenForm({ ...gardenForm, land_plot_id: parseInt(e.target.value || '0') })}
                    className="w-full h-11 border border-border/80 font-semibold text-xs rounded-2xl px-3.5 bg-card text-foreground focus:ring-2 focus:ring-emerald-500/40 outline-none cursor-pointer"
                  >
                    <option value="" className="bg-card text-foreground">-- Pilih Lahan Induk --</option>
                    {effectiveLandPlots.map(l => (
                      <option key={l.id} value={l.id.toString()} className="font-bold text-xs py-2 bg-card text-foreground">
                        {l.plot_name || l.name || l.plot_code} ({l.plot_code || `LHN-${l.id}`})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">Nama Kebun / Blok <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Contoh: Blok Kebun Jagung A1"
                    value={gardenForm.garden_name}
                    onChange={e => setGardenForm({ ...gardenForm, garden_name: e.target.value })}
                    className="rounded-2xl h-11 border-border/80 font-semibold text-xs px-3.5 bg-card shadow-xs focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">{t('Tipe Tanah')}</Label>
                  <select
                    value={gardenForm.soil_type || ''}
                    onChange={e => setGardenForm({ ...gardenForm, soil_type: e.target.value })}
                    className="w-full h-11 border border-border/80 font-semibold text-xs rounded-2xl px-3.5 bg-card text-foreground focus:ring-2 focus:ring-emerald-500/40 outline-none cursor-pointer"
                  >
                    <option value="" className="bg-card text-foreground">-- Pilih Tipe Tanah --</option>
                    {[
                      "Aluvial (Tanah Endapan)",
                      "Andosol (Tanah Vulkanik)",
                      "Latosol (Tanah Merah)",
                      "Regosol (Tanah Pasir)",
                      "Grumusol (Tanah Liat Hitam)",
                      "Podsolik (Tanah Kuning Merah)",
                      "Organosol (Tanah Gambut)"
                    ].map((t) => (
                      <option key={t} value={t} className="font-bold text-xs py-2 bg-card text-foreground">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">{t('Kondisi Sekitar')}</Label>
                    <select
                      value={gardenForm.kondisi_sekitar || ''}
                      onChange={e => setGardenForm({ ...gardenForm, kondisi_sekitar: e.target.value })}
                      className="w-full h-11 border border-border/80 font-semibold text-xs rounded-2xl px-3.5 bg-card text-foreground focus:ring-2 focus:ring-emerald-500/40 outline-none cursor-pointer"
                    >
                      <option value="" className="bg-card text-foreground">-- {t('Pilih Kondisi')} --</option>
                      <option value="pertanian_terbuka" className="font-bold text-xs bg-card text-foreground">{t('Pertanian Terbuka')}</option>
                      <option value="area_industri" className="font-bold text-xs bg-card text-foreground">{t('Area Industri')}</option>
                      <option value="pemukiman_padat" className="font-bold text-xs bg-card text-foreground">{t('Pemukiman Padat')}</option>
                      <option value="hutan_lindung" className="font-bold text-xs bg-card text-foreground">{t('Hutan Lindung')}</option>
                      <option value="pesisir_pantai" className="font-bold text-xs bg-card text-foreground">{t('Pesisir Pantai')}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">{t('Jarak Jalan Utama (m)')}</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="50"
                      value={gardenForm.jarak_jalan_m ?? ''}
                      onChange={e => setGardenForm({ ...gardenForm, jarak_jalan_m: e.target.value ? parseInt(e.target.value) : null })}
                      className="rounded-2xl h-11 border-border/80 font-semibold text-xs px-3.5 bg-card shadow-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">{t('Radius Buffer (m)')}</Label>
                    <Input
                      type="number"
                      min={30}
                      max={90}
                      placeholder="60"
                      value={gardenForm.radius_konteks_m}
                      onChange={e => setGardenForm({ ...gardenForm, radius_konteks_m: parseInt(e.target.value) || 60 })}
                      className="rounded-2xl h-11 border-border/80 font-semibold text-xs px-3.5 bg-card shadow-xs"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  <span className="uppercase tracking-wider text-[10px]">Warna Poligon Kebun</span>
                  <span className="flex items-center gap-2 font-bold text-xs text-foreground">
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white shadow-xs" />
                    Hijau Sistem (#10B981)
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">{t('Keterangan / Catatan Kebun')}</Label>
                  <textarea
                    placeholder="Catatan zonasi blok kebun..."
                    value={gardenForm.keterangan || ''}
                    onChange={e => setGardenForm({ ...gardenForm, keterangan: e.target.value })}
                    className="w-full min-h-[75px] rounded-2xl border border-border/80 bg-card px-3.5 py-2.5 font-medium text-xs resize-none outline-none focus:ring-2 focus:ring-emerald-500/40"
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">Kategori Tanaman <span className="text-destructive">*</span></Label>
                    <select
                      value={selectedCategory}
                      onChange={e => {
                        setSelectedCategory(e.target.value || '');
                        setPlantingForm({ ...plantingForm, komoditi_id: 0 });
                      }}
                      className="w-full h-11 border border-border/80 font-semibold text-xs rounded-2xl px-3.5 bg-card text-foreground focus:ring-2 focus:ring-emerald-500/40 outline-none cursor-pointer"
                    >
                      <option value="" className="bg-card text-foreground">-- {komoditiList.length > 0 ? "Pilih Kategori" : "Memuat Kategori..."} --</option>
                      {uniqueCategories.map(cat => (
                        <option key={cat} value={cat} className="font-bold text-xs py-2 bg-card text-foreground">
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">Komoditi Tanaman <span className="text-destructive">*</span></Label>
                    <select
                      disabled={!selectedCategory}
                      value={plantingForm.komoditi_id ? plantingForm.komoditi_id.toString() : ''}
                      onChange={e => {
                        const kId = parseInt(e.target.value || '0');
                        const selectedK = komoditiList.find(k => k.id === kId);
                        setPlantingForm(prev => ({
                          ...prev,
                          komoditi_id: kId,
                          nama_tanaman: prev.nama_tanaman || (selectedK ? `${selectedK.nama_komoditi} - ${new Date().toLocaleString('id-ID', { month: 'short', year: 'numeric' })}` : '')
                        }));
                      }}
                      className="w-full h-11 border border-border/80 font-semibold text-xs rounded-2xl px-3.5 bg-card text-foreground focus:ring-2 focus:ring-emerald-500/40 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="" className="bg-card text-foreground">-- {selectedCategory ? "Pilih Komoditi" : "Pilih Kategori Dulu"} --</option>
                      {filteredKomoditi.map(k => (
                        <option key={k.id} value={k.id.toString()} className="font-bold text-xs py-2 bg-card text-foreground">
                          {k.nama_komoditi}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">Nama Tanaman / Varietas <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Contoh: Jagung Hibrida Pioneer P35"
                    value={plantingForm.nama_tanaman}
                    onChange={e => setPlantingForm({ ...plantingForm, nama_tanaman: e.target.value })}
                    className="rounded-2xl h-11 border border-border/80 font-semibold text-xs px-3.5 bg-card shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">Lahan Induk <span className="text-destructive">*</span></Label>
                    <select
                      value={plantingForm.land_plot_id ? plantingForm.land_plot_id.toString() : ''}
                      onChange={e => setPlantingForm({ ...plantingForm, land_plot_id: parseInt(e.target.value || '0'), garden_id: 0 })}
                      className="w-full h-11 border border-border/80 font-semibold text-xs rounded-2xl px-3.5 bg-card text-foreground focus:ring-2 focus:ring-emerald-500/40 outline-none cursor-pointer"
                    >
                      <option value="" className="bg-card text-foreground">-- Pilih Lahan --</option>
                      {effectiveLandPlots.map(l => (
                        <option key={l.id} value={l.id.toString()} className="font-bold text-xs py-2 bg-card text-foreground">
                          {l.plot_name || l.name || l.plot_code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">Kebun / Blok <span className="text-destructive">*</span></Label>
                    <select
                      disabled={!plantingForm.land_plot_id}
                      value={plantingForm.garden_id ? plantingForm.garden_id.toString() : ''}
                      onChange={e => setPlantingForm({ ...plantingForm, garden_id: parseInt(e.target.value || '0') })}
                      className="w-full h-11 border border-border/80 font-semibold text-xs rounded-2xl px-3.5 bg-card text-foreground focus:ring-2 focus:ring-emerald-500/40 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="" className="bg-card text-foreground">-- {plantingForm.land_plot_id ? "Pilih Kebun" : "Pilih Lahan Dulu"} --</option>
                      {filteredGardensForPlanting.map(g => (
                        <option key={g.id} value={g.id.toString()} className="font-bold text-xs py-2 bg-card text-foreground">
                          {g.garden_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">Perangkat IoT</Label>
                    <select
                      value={plantingForm.device_id ? plantingForm.device_id.toString() : 'none'}
                      onChange={e => setPlantingForm({ ...plantingForm, device_id: e.target.value === 'none' ? 0 : parseInt(e.target.value || '0') })}
                      className="w-full h-11 border border-border/80 font-semibold text-xs rounded-2xl px-3.5 bg-card text-foreground focus:ring-2 focus:ring-emerald-500/40 outline-none cursor-pointer"
                    >
                      <option value="none" className="bg-card text-muted-foreground italic font-medium">-- {t('Belum dipasang / Tidak ada')} --</option>
                      {nodes.map((n: any) => (
                        <option key={n.db_id || n.id} value={(n.db_id || n.id).toString()} className="font-bold text-xs py-2 bg-card text-foreground">
                          {n.name} ({n.device_code || n.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">{t('Tanggal Tanam')}</Label>
                    <Input
                      type="date"
                      value={plantingForm.tanggal_tanam}
                      onChange={e => setPlantingForm({ ...plantingForm, tanggal_tanam: e.target.value })}
                      className="rounded-2xl h-11 border border-border/80 font-semibold text-xs px-3.5 bg-card shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-extrabold text-xs text-foreground uppercase tracking-wider">{t('Status / Fase Tumbuh')}</Label>
                  <Select
                    value={plantingForm.status_fase}
                    onValueChange={v => setPlantingForm({ ...plantingForm, status_fase: v })}
                  >
                    <SelectTrigger className="w-full h-11 border border-border/80 font-semibold text-xs rounded-2xl px-3.5 bg-card shadow-xs">
                      <SelectValue placeholder="Pilih Fase" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-border/80 shadow-2xl z-[10005]">
                      <SelectItem value="Persiapan">{t('Persiapan (Lahan/Bibit)')}</SelectItem>
                      <SelectItem value="Vegetatif">{t('Vegetatif (Pertumbuhan Daun/Akar)')}</SelectItem>
                      <SelectItem value="Generatif">{t('Generatif (Pembungaan/Pembuahan)')}</SelectItem>
                      <SelectItem value="Panen">{t('Panen')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-border/60 flex flex-row items-center justify-end gap-3 rounded-b-[28px]">
          <Button variant="outline" className="rounded-2xl h-11 font-extrabold text-xs px-5 border-border/80 hover:bg-muted" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            <X size={16} className="mr-1.5" /> Batal
          </Button>
          <Button
            disabled={isSubmitting}
            className="rounded-2xl h-11 font-black text-xs px-7 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-all cursor-pointer gap-2"
            onClick={activeTab === 'lahan' ? handleSaveLand : activeTab === 'kebun' ? handleSaveGarden : handleSavePlanting}
          >
            <Save size={16} /> {isSubmitting ? 'Menyimpan Data...' : 'Simpan Data'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
