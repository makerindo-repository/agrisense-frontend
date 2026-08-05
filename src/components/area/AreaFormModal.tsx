import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import api from '../../lib/api';
import { reverseGeocode } from '../../utils/geolocation';
import { generateUniqueCode } from '../../utils/generators';
import LeafletDrawMap, { PolygonDrawResult } from '../LeafletDrawMap';

// Import types if needed
import { LandPlot, Garden } from '../../lib/mockData';

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

  const filteredGardensForPlanting = useMemo(() => {
    if (!plantingForm.land_plot_id) return gardens;
    return gardens.filter(g => g.land_plot_id === plantingForm.land_plot_id);
  }, [gardens, plantingForm.land_plot_id]);

  const selectedParentPolygon = useMemo(() => {
    if (activeTab === 'kebun' && gardenForm.land_plot_id) {
      const parent = landPlots.find(l => l.id === gardenForm.land_plot_id);
      return parent?.polygon;
    }
    return null;
  }, [activeTab, gardenForm.land_plot_id, landPlots]);

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
        "sm:max-w-[1100px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl max-h-[92vh] flex flex-col",
        activeTab === 'tanaman' && "sm:max-w-[600px]"
      )}>
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/50">
          <DialogTitle className="text-xl font-bold">
            {activeTab === 'lahan'
              ? (editingLand ? 'Edit Data Lahan' : 'Tambah Lahan Baru')
              : activeTab === 'kebun'
              ? (editingGarden ? 'Edit Data Kebun' : 'Tambah Kebun Baru')
              : (editingPlanting ? 'Edit Data Tanaman' : 'Tambah Tanaman Aktif')
            }
          </DialogTitle>
          <DialogDescription>
            {activeTab === 'lahan'
              ? 'Gambar batas area lahan di peta, lalu isi data di sebelah kanan.'
              : activeTab === 'kebun'
              ? 'Pilih Lahan Induk, lalu gambar blok kebun di dalam area lahan.'
              : 'Isi formulir untuk mendaftarkan tanaman yang sedang aktif dipantau.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* ── LEFT: MAP (50%) ── */}
          {activeTab !== 'tanaman' && (
            <div className="w-full lg:w-[50%] relative bg-muted/10 min-h-[300px]">
            <div className="absolute top-4 right-4 z-[1000] bg-background/80 backdrop-blur-sm px-4 py-2 rounded-md border border-border shadow-sm pointer-events-none whitespace-nowrap">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                Petunjuk: Klik tombol di kiri peta untuk menggambar poligon area
              </p>
            </div>

            {activeTab === 'lahan' ? (
              <LeafletDrawMap
                height="100%"
                existingPolygon={landForm.polygon}
                drawColor={landForm.color || '#F59E0B'}
                onPolygonChange={async (res: PolygonDrawResult | null) => {
                  if (res) {
                    setLandForm(prev => ({
                      ...prev,
                      polygon: res.polygon,
                      latitude: res.latitude,
                      longitude: res.longitude,
                      area_hectare: res.area_hectare,
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
                <div className="absolute bottom-2 left-2 z-[1000] bg-background/95 backdrop-blur-sm p-2.5 rounded-lg border border-border shadow-xl flex flex-col gap-1 text-[9px] font-semibold min-w-[130px]">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground uppercase">Luas Area</span>
                    <span className="text-foreground">{Number(landForm.area_hectare || 0).toFixed(3)} Ha</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground uppercase">Latitude</span>
                    <span className="text-foreground">{Number(landForm.latitude || 0).toFixed(7)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground uppercase">Longitude</span>
                    <span className="text-foreground">{Number(landForm.longitude || 0).toFixed(7)}</span>
                  </div>
                </div>
              </LeafletDrawMap>
            ) : (
              <LeafletDrawMap
                height="100%"
                existingPolygon={gardenForm.polygon}
                parentLandPolygon={selectedParentPolygon}
                parentLandColor={selectedParentColor}
                existingGardens={siblingGardens}
                drawColor={gardenForm.color || '#22C55E'}
                onPolygonChange={async (res: PolygonDrawResult | null) => {
                  if (res) {
                    setGardenForm(prev => ({
                      ...prev,
                      polygon: res.polygon,
                      latitude: res.latitude,
                      longitude: res.longitude,
                      area_hectare: res.area_hectare,
                    }));
                  } else {
                    setGardenForm(prev => ({ ...prev, polygon: null, area_hectare: 0, latitude: 0, longitude: 0 }));
                  }
                }}
              >
                <div className="absolute bottom-2 left-2 z-[1000] bg-background/95 backdrop-blur-sm p-2.5 rounded-lg border border-border shadow-xl flex flex-col gap-1 text-[9px] font-semibold min-w-[130px]">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground uppercase">Luas Blok</span>
                    <span className="text-foreground">{Number(gardenForm.area_hectare || 0).toFixed(3)} Ha</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground uppercase">Latitude</span>
                    <span className="text-foreground">{Number(gardenForm.latitude || 0).toFixed(7)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground uppercase">Longitude</span>
                    <span className="text-foreground">{Number(gardenForm.longitude || 0).toFixed(7)}</span>
                  </div>
                </div>
              </LeafletDrawMap>
            )}
          </div>
          )}

          {/* ── RIGHT: FORM FIELDS (50% or 100%) ── */}
          <div className={cn("overflow-y-auto p-6 space-y-5 bg-card border-l border-border/50", activeTab === 'tanaman' ? 'w-full' : 'w-full lg:w-[50%]')}>
            {activeTab === 'lahan' ? (
              <>
                <div className="space-y-1.5">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Nama Lahan <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Lahan Utama Sektor Utara"
                    value={landForm.plot_name}
                    onChange={e => setLandForm({ ...landForm, plot_name: e.target.value })}
                    className="rounded-xl h-11 border-border/50 font-medium text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Pemilik Lahan</Label>
                  <Input
                    placeholder="Nama pemilik lahan"
                    value={landForm.owner_name}
                    onChange={e => setLandForm({ ...landForm, owner_name: e.target.value })}
                    className="rounded-xl h-11 border-border/50 font-medium text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Alamat</Label>
                  <Input
                    placeholder="Alamat dapat terisi otomatis setelah membuat poligon"
                    value={landForm.address}
                    onChange={e => setLandForm({ ...landForm, address: e.target.value })}
                    className="rounded-xl h-11 border-border/50 font-medium text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Warna Area Lahan</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card shadow-sm hover:bg-muted/50 transition-colors">
                      <input
                        type="color"
                        value={landForm.color || '#F59E0B'}
                        onChange={e => setLandForm({ ...landForm, color: e.target.value })}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div
                        className="w-5 h-5 rounded-md border border-black/10 shadow-inner"
                        style={{ backgroundColor: landForm.color || '#F59E0B' }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground font-medium">Kosongkan untuk warna default (Oranye)</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Keterangan</Label>
                  <textarea
                    placeholder="Lahan berada di dekat sungai"
                    value={landForm.keterangan || ''}
                    onChange={e => setLandForm({ ...landForm, keterangan: e.target.value })}
                    className="w-full min-h-[80px] rounded-xl border border-border/50 bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    rows={3}
                  />
                </div>
                {!editingLand && (
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <p className="text-[10px] font-bold text-amber-700 mb-1">ℹ Petunjuk Menambah Lahan</p>
                    <ul className="text-[10px] text-amber-600/80 space-y-0.5 list-disc pl-3">
                      <li>Gambar polygon area lahan pada peta di sebelah kiri</li>
                      <li>Alamat akan terisi otomatis berdasarkan titik koordinat</li>
                      <li>Setelah lahan dibuat, Anda dapat menambahkan Kebun di dalamnya</li>
                    </ul>
                  </div>
                )}
              </>
            ) : activeTab === 'kebun' ? (
              <>
                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Lahan Induk <span className="text-destructive">*</span></Label>
                  <Select
                    value={gardenForm.land_plot_id ? gardenForm.land_plot_id.toString() : ''}
                    onValueChange={v => setGardenForm({ ...gardenForm, land_plot_id: parseInt(v || '0') })}
                  >
                    <SelectTrigger className="w-full h-20 border-none bg-muted/50 font-medium text-sm rounded-xl px-6">
                      <SelectValue placeholder="Pilih Lahan Induk">
                        {gardenForm.land_plot_id
                          ? landPlots.find(l => l.id === gardenForm.land_plot_id)?.plot_name
                          : "Pilih Lahan Induk"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl z-[9999]" sideOffset={5}>
                      {landPlots.length > 0 ? (
                        landPlots.map(l => (
                          <SelectItem key={l.id} value={l.id.toString()} className="font-medium py-2.5 text-xs hover:bg-primary/10">
                            {l.plot_name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-4 text-center text-[10px] text-muted-foreground font-medium">TIDAK ADA DATA LAHAN</div>
                      )}
                    </SelectContent>
                  </Select>
                  {landPlots.length === 0 && (
                    <p className="text-[10px] text-destructive font-medium italic">⚠ Tambahkan Lahan Induk terlebih dahulu di tab sebelah.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Nama Kebun <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Blok Tomat A1"
                    value={gardenForm.garden_name}
                    onChange={e => setGardenForm({ ...gardenForm, garden_name: e.target.value })}
                    className="rounded-xl h-11 border-border/50 font-medium text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Tipe Tanah</Label>
                  <Select value={gardenForm.soil_type} onValueChange={v => setGardenForm({ ...gardenForm, soil_type: v || '' })}>
                    <SelectTrigger className="w-full h-20 border-none bg-muted/50 font-medium text-sm rounded-xl px-6">
                      <SelectValue placeholder="Pilih tipe tanah" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl z-[9999]" sideOffset={5}>
                      {[
                        "Aluvial (Tanah Endapan)",
                        "Andosol (Tanah Vulkanik)",
                        "Latosol (Tanah Merah)",
                        "Regosol (Tanah Pasir)",
                        "Grumusol (Tanah Liat Hitam)",
                        "Podsolik (Tanah Kuning Merah)",
                        "Organosol (Tanah Gambut)"
                      ].map((t) => (
                        <SelectItem key={t} value={t} className="font-medium py-2.5 text-xs hover:bg-primary/10">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Kondisi Sekitar</Label>
                    <Select value={gardenForm.kondisi_sekitar} onValueChange={v => setGardenForm({ ...gardenForm, kondisi_sekitar: v })}>
                      <SelectTrigger className="rounded-xl h-11 border-border/50 font-medium text-sm">
                        <SelectValue placeholder="Pilih kondisi">
                          {gardenForm.kondisi_sekitar ? gardenForm.kondisi_sekitar.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : "Pilih kondisi"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="area_industri">Area Industri</SelectItem>
                        <SelectItem value="pemukiman_padat">Pemukiman Padat</SelectItem>
                        <SelectItem value="hutan_lindung">Hutan Lindung</SelectItem>
                        <SelectItem value="pertanian_terbuka">Pertanian Terbuka</SelectItem>
                        <SelectItem value="pesisir_pantai">Pesisir Pantai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Radius (m)</Label>
                    <Input
                      type="number"
                      min={30}
                      max={90}
                      placeholder="60"
                      value={gardenForm.radius_konteks_m}
                      onChange={e => setGardenForm({ ...gardenForm, radius_konteks_m: parseInt(e.target.value) || 60 })}
                      className="rounded-xl h-11 border-border/50 font-medium text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Jarak Jalan (m)</Label>
                    <div className="h-11 rounded-xl border border-border/50 bg-muted/30 flex items-center px-3 cursor-not-allowed">
                      <span className="text-sm font-medium text-muted-foreground/80">
                        {gardenForm.jarak_jalan_m ? `${gardenForm.jarak_jalan_m} m` : 'Otomatis (AI)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Warna Area Kebun</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card shadow-sm hover:bg-muted/50 transition-colors">
                      <input
                        type="color"
                        value={gardenForm.color || '#22C55E'}
                        onChange={e => setGardenForm({ ...gardenForm, color: e.target.value })}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div
                        className="w-5 h-5 rounded-md border border-black/10 shadow-inner"
                        style={{ backgroundColor: gardenForm.color || '#22C55E' }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground font-medium">Kosongkan untuk warna default (Hijau)</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Keterangan</Label>
                  <textarea
                    placeholder="Kebun ini digunakan untuk rotasi tanaman"
                    value={gardenForm.keterangan || ''}
                    onChange={e => setGardenForm({ ...gardenForm, keterangan: e.target.value })}
                    className="w-full min-h-[80px] rounded-xl border border-border/50 bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Kategori Tanaman <span className="text-destructive">*</span></Label>
                    <Select
                      value={selectedCategory}
                      onValueChange={v => {
                        setSelectedCategory(v || '');
                        setPlantingForm({ ...plantingForm, komoditi_id: 0 });
                      }}
                    >
                      <SelectTrigger className="w-full h-11 border-border/50 font-medium text-sm rounded-xl">
                        <SelectValue placeholder={komoditiList.length > 0 ? "Pilih Kategori" : "Memuat data..."} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl z-[9999]">
                        {uniqueCategories.length > 0 ? (
                          uniqueCategories.map(cat => (
                            <SelectItem key={cat} value={cat} className="font-medium py-2 text-xs">
                              {cat}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled className="text-[10px] italic">Data komoditi tidak tersedia</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Pilih Komoditi Tanaman <span className="text-destructive">*</span></Label>
                    <Select
                      disabled={!selectedCategory}
                      value={plantingForm.komoditi_id ? plantingForm.komoditi_id.toString() : ''}
                      onValueChange={v => {
                        const kId = parseInt(v || '0');
                        const selectedK = komoditiList.find(k => k.id === kId);
                        setPlantingForm(prev => ({
                          ...prev,
                          komoditi_id: kId,
                          nama_tanaman: prev.nama_tanaman || (selectedK ? `${selectedK.nama_komoditi} - ${new Date().toLocaleString('id-ID', { month: 'short', year: 'numeric' })}` : '')
                        }));
                      }}
                    >
                      <SelectTrigger className="w-full h-11 border-border/50 font-medium text-sm rounded-xl">
                        <SelectValue placeholder={selectedCategory ? "Pilih Komoditi" : "Pilih Kategori Dulu"}>
                          {plantingForm.komoditi_id
                            ? komoditiList.find(k => k.id === plantingForm.komoditi_id)?.nama_komoditi
                            : (selectedCategory ? "Pilih Komoditi" : "Pilih Kategori Dulu")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl z-[9999]">
                        {filteredKomoditi.map(k => (
                          <SelectItem key={k.id} value={k.id.toString()} className="font-medium py-2 text-xs">
                            <div className="flex flex-col">
                              <span>{k.nama_komoditi}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>


                {/* Identitas Penanaman dihapus sesuai permintaan, auto-generated di background */}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Lokasi Lahan Induk <span className="text-destructive">*</span></Label>
                    <Select
                      value={plantingForm.land_plot_id ? plantingForm.land_plot_id.toString() : ''}
                      onValueChange={v => setPlantingForm({ ...plantingForm, land_plot_id: parseInt(v || '0'), garden_id: 0 })}
                    >
                      <SelectTrigger className="w-full h-11 border-border/50 font-medium text-sm rounded-xl">
                        <SelectValue placeholder="Pilih Lahan Induk">
                          {plantingForm.land_plot_id
                            ? landPlots.find(l => l.id === plantingForm.land_plot_id)?.plot_name
                            : "Pilih Lahan"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl z-[9999]">
                        {landPlots.length > 0 ? (
                          landPlots.map(l => (
                            <SelectItem key={l.id} value={l.id.toString()} className="font-medium py-2.5 text-xs">
                              {l.plot_name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-4 text-center text-[10px] text-muted-foreground font-medium">TIDAK ADA DATA LAHAN</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Lokasi Kebun <span className="text-destructive">*</span></Label>
                    <Select
                      disabled={!plantingForm.land_plot_id}
                      value={plantingForm.garden_id ? plantingForm.garden_id.toString() : ''}
                      onValueChange={v => setPlantingForm({ ...plantingForm, garden_id: parseInt(v || '0') })}
                    >
                      <SelectTrigger className="w-full h-11 border-border/50 font-medium text-sm rounded-xl">
                        <SelectValue placeholder={plantingForm.land_plot_id ? "Pilih Kebun" : "Pilih Lahan Dulu"}>
                          {plantingForm.garden_id
                            ? gardens.find(g => g.id === plantingForm.garden_id)?.garden_name
                            : (plantingForm.land_plot_id ? "Pilih Kebun" : "Pilih Lahan Dulu")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl z-[9999]">
                        {filteredGardensForPlanting.length > 0 ? (
                          filteredGardensForPlanting.map(g => (
                            <SelectItem key={g.id} value={g.id.toString()} className="font-medium py-2.5 text-xs">
                              {g.garden_name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-4 text-center text-[10px] text-muted-foreground font-medium">KEBUN KOSONG PADA LAHAN INI</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                    <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Perangkat IoT</Label>
                    <Select
                      value={plantingForm.device_id ? plantingForm.device_id.toString() : 'none'}
                      onValueChange={v => setPlantingForm({ ...plantingForm, device_id: v === 'none' ? 0 : parseInt(v || '0') })}
                    >
                      <SelectTrigger className="w-full h-11 border-border/50 font-medium text-sm rounded-xl">
                        <SelectValue placeholder="Pilih Perangkat (Opsional)">
                          {plantingForm.device_id > 0
                            ? nodes.find(n => n.db_id === plantingForm.device_id)?.name
                            : "Belum dipasang"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl z-[9999]">
                        <SelectItem value="none" className="font-medium py-2.5 text-xs italic text-muted-foreground">
                          Belum dipasang / Tidak ada
                        </SelectItem>
                        {nodes.length > 0 ? (
                          nodes.map((n: any) => (
                            <SelectItem key={n.db_id} value={n.db_id.toString()} className="font-medium py-2.5 text-xs">
                              {n.name} - {n.id}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-4 text-center text-[10px] text-muted-foreground font-medium">TIDAK ADA DATA PERANGKAT</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                <div className="space-y-1.5">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Tanggal Tanam</Label>
                  <Input
                    type="date"
                    value={plantingForm.tanggal_tanam}
                    onChange={e => setPlantingForm({ ...plantingForm, tanggal_tanam: e.target.value })}
                    className="rounded-xl h-11 border-border/50 font-medium text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Status / Fase Tanaman</Label>
                  <Select
                    value={plantingForm.status_fase}
                    onValueChange={v => setPlantingForm({ ...plantingForm, status_fase: v })}
                  >
                    <SelectTrigger className="w-full h-11 border-border/50 font-medium text-sm rounded-xl">
                      <SelectValue placeholder="Pilih Fase" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl z-[9999]">
                      <SelectItem value="Persiapan">Persiapan (Lahan/Bibit)</SelectItem>
                      <SelectItem value="Vegetatif">Vegetatif (Pertumbuhan Daun/Akar)</SelectItem>
                      <SelectItem value="Generatif">Generatif (Pembungaan/Pembuahan)</SelectItem>
                      <SelectItem value="Panen">Panen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 pt-4 pb-8 sm:pb-6 bg-muted/30 border-t border-border/50 flex-row justify-end gap-3">
          <Button variant="outline" className="rounded-xl h-11 font-bold" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            <X size={16} className="mr-2" /> Batal
          </Button>
          <Button
            disabled={isSubmitting}
            className={cn(
              "rounded-xl h-11 font-bold px-8 shadow-lg gap-2",
              activeTab === 'kebun' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : 
              activeTab === 'tanaman' ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20" : "shadow-primary/20",
              isSubmitting && "opacity-50 cursor-not-allowed"
            )}
            onClick={activeTab === 'lahan' ? handleSaveLand : activeTab === 'kebun' ? handleSaveGarden : handleSavePlanting}
          >
            <Save size={16} /> {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
