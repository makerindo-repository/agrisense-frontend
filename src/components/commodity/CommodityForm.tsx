import React, { useState, useEffect } from 'react';
import { Upload, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from "@/components/ui/button";
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import api from '../../lib/api';

import {
  KATEGORI_OPTIONS,
  PRESET_KOMODITI_MAP,
  PRESET_HAMA,
  PRESET_PENYAKIT
} from '../../constants/commodityConstants';
import { fetchLatinName } from '../../services/wikidataService';

export interface CommodityFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editing: any | null; // Komoditi type
  onSaveSuccess: () => void;
}

const CommodityForm: React.FC<CommodityFormProps> = ({ isOpen, onOpenChange, editing, onSaveSuccess }) => {
  const [formTab, setFormTab] = useState('dasar');
  const [saving, setSaving] = useState(false);
  
  // Basic Info
  const [fNama, setFNama] = useState('');
  const [fNamaTemp, setFNamaTemp] = useState('');
  const [customKomoditiList, setCustomKomoditiList] = useState<string[]>([]);
  const [isCustomNama, setIsCustomNama] = useState(false);
  const [fKategori, setFKategori] = useState('');
  const [fLatin, setFLatin] = useState('');
  const [fVarietas, setFVarietas] = useState('');
  const [fDeskripsi, setFDeskripsi] = useState('');
  const [fStatus, setFStatus] = useState('Aktif');
  const [fFoto, setFFoto] = useState<File | null>(null);
  const [isSearchingLatin, setIsSearchingLatin] = useState(false);

  // Lingkungan
  const [fSuhuMin, setFSuhuMin] = useState('');
  const [fSuhuMax, setFSuhuMax] = useState('');
  const [fKelUdaraMin, setFKelUdaraMin] = useState('');
  const [fKelUdaraMax, setFKelUdaraMax] = useState('');
  const [fPhMin, setFPhMin] = useState('');
  const [fPhMax, setFPhMax] = useState('');
  const [fKetinggianMin, setFKetinggianMin] = useState('');
  const [fKetinggianMax, setFKetinggianMax] = useState('');
  const [fJenisTanah, setFJenisTanah] = useState('');
  const [fDrainase, setFDrainase] = useState('');

  // Hama & Penyakit
  const [fJenisHama, setFJenisHama] = useState('');
  const [isCustomHama, setIsCustomHama] = useState(false);
  const [fJenisHamaTemp, setFJenisHamaTemp] = useState('');
  const [customHamaList, setCustomHamaList] = useState<string[]>([]);

  const [fJenisPenyakit, setFJenisPenyakit] = useState('');
  const [isCustomPenyakit, setIsCustomPenyakit] = useState(false);
  const [fJenisPenyakitTemp, setFJenisPenyakitTemp] = useState('');
  const [customPenyakitList, setCustomPenyakitList] = useState<string[]>([]);

  // Fase Tanam
  const [fUsiaMin, setFUsiaMin] = useState('');
  const [fUsiaMax, setFUsiaMax] = useState('');
  const [fUsiaPanen, setFUsiaPanen] = useState('');
  const [fSatuanUsia, setFSatuanUsia] = useState('hari');
  const [fPembibitan, setFPembibitan] = useState('');
  const [fVegetatif, setFVegetatif] = useState('');
  const [fGeneratif, setFGeneratif] = useState('');
  const [fPanen, setFPanen] = useState('');
  const [fCatatanBudidaya, setFCatatanBudidaya] = useState('');

  // Nutrisi
  const [fNitrogenMin, setFNitrogenMin] = useState('');
  const [fNitrogenMax, setFNitrogenMax] = useState('');
  const [fFosforMin, setFFosforMin] = useState('');
  const [fFosforMax, setFFosforMax] = useState('');
  const [fKaliumMin, setFKaliumMin] = useState('');
  const [fKaliumMax, setFKaliumMax] = useState('');
  const [fOrganikMin, setFOrganikMin] = useState('');
  const [fOrganikMax, setFOrganikMax] = useState('');
  const [fRekPemupukan, setFRekPemupukan] = useState('');

  // Rekomendasi
  const [fStatusKes, setFStatusKes] = useState('Sesuai');
  const [fSkorKes, setFSkorKes] = useState('');
  const [fKatRek, setFKatRek] = useState('Baik');
  const [fRekTindakan, setFRekTindakan] = useState('');
  const [fPrioritas, setFPrioritas] = useState('Sedang');
  const [fCatatanRek, setFCatatanRek] = useState('');

  const resetForm = () => {
    setFNama('');
    setFKategori('');
    setFLatin('');
    setFVarietas('');
    setFUsiaPanen('');
    setFDeskripsi('');
    setFStatus('Aktif');
    setFFoto(null);
    setFormTab('dasar');

    setFSuhuMin(''); setFSuhuMax(''); setFKelUdaraMin(''); setFKelUdaraMax(''); setFPhMin(''); setFPhMax(''); setFKetinggianMin(''); setFKetinggianMax(''); setFJenisTanah(''); setFDrainase('');
    setFJenisHama(''); setFJenisPenyakit('');
    setFUsiaMin(''); setFUsiaMax(''); setFSatuanUsia('hari'); setFPembibitan(''); setFVegetatif(''); setFGeneratif(''); setFPanen(''); setFCatatanBudidaya('');
    setFNitrogenMin(''); setFNitrogenMax(''); setFFosforMin(''); setFFosforMax(''); setFKaliumMin(''); setFKaliumMax(''); setFOrganikMin(''); setFOrganikMax(''); setFRekPemupukan('');
    setFStatusKes('Sesuai'); setFSkorKes(''); setFKatRek('Baik'); setFRekTindakan(''); setFPrioritas('Sedang'); setFCatatanRek('');
  };

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        const k = editing;
        setFNama(k.nama_komoditi);
        const presets = PRESET_KOMODITI_MAP[k.kategori_tanaman] || Object.values(PRESET_KOMODITI_MAP).flat();
        if (!presets.includes(k.nama_komoditi)) {
          setCustomKomoditiList(prev => Array.from(new Set([...prev, k.nama_komoditi])));
        }
        setIsCustomNama(false);
        setFKategori(k.kategori_tanaman);
        setFLatin(k.nama_latin || '');
        setFVarietas(k.varietas || '');
        setFDeskripsi(k.deskripsi || '');
        setFStatus(k.status);
        setFFoto(null);
        // Lingkungan
        const lg = k.lingkungan;
        if (lg) {
          setFSuhuMin(lg.suhu_min?.toString() || '');
          setFSuhuMax(lg.suhu_max?.toString() || '');
          setFKelUdaraMin(lg.kelembapan_udara_min?.toString() || '');
          setFKelUdaraMax(lg.kelembapan_udara_max?.toString() || '');
          setFPhMin(lg.ph_min?.toString() || '');
          setFPhMax(lg.ph_max?.toString() || '');
          setFKetinggianMin(lg.ketinggian_min?.toString() || '');
          setFKetinggianMax(lg.ketinggian_max?.toString() || '');
          setFJenisTanah(lg.jenis_tanah || '');
          setFDrainase(lg.drainase || '');
        } else {
          setFSuhuMin(''); setFSuhuMax(''); setFKelUdaraMin(''); setFKelUdaraMax(''); setFPhMin(''); setFPhMax(''); setFKetinggianMin(''); setFKetinggianMax(''); setFJenisTanah(''); setFDrainase('');
        }
        // Hama
        const hamas = (k.hama_penyakit || []).filter((h: any) => h.jenis === 'Hama').map((h: any) => h.nama).join(', ');
        const penyakits = (k.hama_penyakit || []).filter((h: any) => h.jenis === 'Penyakit').map((h: any) => h.nama).join(', ');
        setFJenisHama(hamas);
        setFJenisPenyakit(penyakits);
        // Fase Tanam
        const ft = k.fase_tanam;
        if (ft) {
          setFUsiaMin(ft.usia_tanam_min?.toString() || '');
          setFUsiaMax(ft.usia_tanam_max?.toString() || '');
          setFUsiaPanen(ft.usia_tanam_max?.toString() || '');
          setFSatuanUsia(ft.satuan_usia || 'hari');
          setFPembibitan(ft.fase_pembibitan || '');
          setFVegetatif(ft.fase_vegetatif || '');
          setFGeneratif(ft.fase_generatif || '');
          setFPanen(ft.fase_panen || '');
          setFCatatanBudidaya(ft.catatan_budidaya || '');
        } else {
          setFUsiaMin(''); setFUsiaMax(''); setFSatuanUsia('hari'); setFPembibitan(''); setFVegetatif(''); setFGeneratif(''); setFPanen(''); setFCatatanBudidaya('');
        }
        // Nutrisi
        const nt = k.nutrisi;
        if (nt) {
          setFNitrogenMin(nt.nitrogen_min?.toString() || '');
          setFNitrogenMax(nt.nitrogen_max?.toString() || '');
          setFFosforMin(nt.fosfor_min?.toString() || '');
          setFFosforMax(nt.fosfor_max?.toString() || '');
          setFKaliumMin(nt.kalium_min?.toString() || '');
          setFKaliumMax(nt.kalium_max?.toString() || '');
          setFOrganikMin(nt.bahan_organik_min?.toString() || '');
          setFOrganikMax(nt.bahan_organik_max?.toString() || '');
          setFRekPemupukan(nt.rekomendasi_pemupukan || '');
        } else {
          setFNitrogenMin(''); setFNitrogenMax(''); setFFosforMin(''); setFFosforMax(''); setFKaliumMin(''); setFKaliumMax(''); setFOrganikMin(''); setFOrganikMax(''); setFRekPemupukan('');
        }
        // Rekomendasi
        const rek = k.rekomendasi;
        if (rek) {
          setFStatusKes(rek.status_kesesuaian_lahan || 'Sesuai');
          setFSkorKes(rek.skor_kesesuaian?.toString() || '');
          setFKatRek(rek.kategori_rekomendasi || 'Baik');
          setFRekTindakan(rek.rekomendasi_tindakan || '');
          setFPrioritas(rek.prioritas_tindakan || 'Sedang');
          setFCatatanRek(rek.catatan_rekomendasi || '');
        } else {
          setFStatusKes('Sesuai'); setFSkorKes(''); setFKatRek('Baik'); setFRekTindakan(''); setFPrioritas('Sedang'); setFCatatanRek('');
        }
        setFormTab('dasar');
      } else {
        resetForm();
      }
    }
  }, [isOpen, editing]);

  const handleSave = async () => {
    if (!fNama || !fKategori) {
      toast.error('Nama komoditi dan kategori wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('nama_komoditi', fNama);
      formData.append('kategori_tanaman', fKategori);
      if (fLatin) formData.append('nama_latin', fLatin);
      if (fVarietas) formData.append('varietas', fVarietas);
      if (fDeskripsi) formData.append('deskripsi', fDeskripsi);
      formData.append('status', fStatus);
      if (fFoto) formData.append('foto', fFoto);

      const lingkungan = {
        suhu_min: fSuhuMin ? parseFloat(fSuhuMin) : null,
        suhu_max: fSuhuMax ? parseFloat(fSuhuMax) : null,
        kelembapan_udara_min: fKelUdaraMin ? parseFloat(fKelUdaraMin) : null,
        kelembapan_udara_max: fKelUdaraMax ? parseFloat(fKelUdaraMax) : null,
        ph_min: fPhMin ? parseFloat(fPhMin) : null,
        ph_max: fPhMax ? parseFloat(fPhMax) : null,
        ketinggian_min: fKetinggianMin ? parseInt(fKetinggianMin) : null,
        ketinggian_max: fKetinggianMax ? parseInt(fKetinggianMax) : null,
        jenis_tanah: fJenisTanah || null,
        drainase: fDrainase || null,
      };
      formData.append('lingkungan', JSON.stringify(lingkungan));

      const hama_penyakit = [
        ...fJenisHama.split(',').filter(s => s.trim()).map(s => ({ nama: s.trim(), jenis: 'Hama' })),
        ...fJenisPenyakit.split(',').filter(s => s.trim()).map(s => ({ nama: s.trim(), jenis: 'Penyakit' })),
      ];
      formData.append('hama_penyakit', JSON.stringify(hama_penyakit));

      const fase_tanam = {
        usia_tanam_min: fUsiaMin ? parseInt(fUsiaMin) : null,
        usia_tanam_max: fUsiaMax ? parseInt(fUsiaMax) : (fUsiaPanen ? parseInt(fUsiaPanen) : null),
        satuan_usia: fSatuanUsia,
        fase_pembibitan: fPembibitan || null,
        fase_vegetatif: fVegetatif || null,
        fase_generatif: fGeneratif || null,
        fase_panen: fPanen || null,
        catatan_budidaya: fCatatanBudidaya || null,
      };
      formData.append('fase_tanam', JSON.stringify(fase_tanam));

      const nutrisi = {
        nitrogen_min: fNitrogenMin ? parseFloat(fNitrogenMin) : null,
        nitrogen_max: fNitrogenMax ? parseFloat(fNitrogenMax) : null,
        fosfor_min: fFosforMin ? parseFloat(fFosforMin) : null,
        fosfor_max: fFosforMax ? parseFloat(fFosforMax) : null,
        kalium_min: fKaliumMin ? parseFloat(fKaliumMin) : null,
        kalium_max: fKaliumMax ? parseFloat(fKaliumMax) : null,
        bahan_organik_min: fOrganikMin ? parseFloat(fOrganikMin) : null,
        bahan_organik_max: fOrganikMax ? parseFloat(fOrganikMax) : null,
        rekomendasi_pemupukan: fRekPemupukan || null,
      };
      formData.append('nutrisi', JSON.stringify(nutrisi));

      const rekomendasi = {
        status_kesesuaian_lahan: fStatusKes,
        skor_kesesuaian: fSkorKes ? parseInt(fSkorKes) : null,
        kategori_rekomendasi: fKatRek,
        rekomendasi_tindakan: fRekTindakan || null,
        prioritas_tindakan: fPrioritas,
        catatan_rekomendasi: fCatatanRek || null,
      };
      formData.append('rekomendasi', JSON.stringify(rekomendasi));

      if (editing) {
        formData.append('_method', 'PUT');
        await api.post(`/komoditi/${editing.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Komoditi berhasil diperbarui');
      } else {
        await api.post('/komoditi', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Komoditi berhasil ditambahkan');
      }
      onOpenChange(false);
      resetForm();
      onSaveSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menyimpan komoditi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[800px] md:max-w-4xl lg:max-w-5xl max-h-[95vh] overflow-y-auto rounded-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{editing ? 'Edit Komoditi' : 'Tambah Komoditi'}</DialogTitle>
          <DialogDescription className="text-sm">
            {editing?.is_system ? 'Data bawaan sistem — beberapa field dilindungi.' : 'Isi informasi komoditi tanaman.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={formTab} onValueChange={setFormTab} orientation="vertical" className="mt-4 w-full flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-56 shrink-0">
            <TabsList className="flex flex-col w-full h-auto bg-muted/40 p-1.5 gap-1 rounded-lg">
              <TabsTrigger value="dasar" className="w-full justify-start text-left px-3 py-2 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Info Dasar</TabsTrigger>
              <TabsTrigger value="lingkungan" className="w-full justify-start text-left px-3 py-2 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Lingkungan</TabsTrigger>
              <TabsTrigger value="hama" className="w-full justify-start text-left px-3 py-2 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Hama & Penyakit</TabsTrigger>
              <TabsTrigger value="siklus" className="w-full justify-start text-left px-3 py-2 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Siklus Tanam</TabsTrigger>
              <TabsTrigger value="nutrisi" className="w-full justify-start text-left px-3 py-2 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Nutrisi</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-w-0 min-h-[450px]">
            <TabsContent value="dasar" className="m-0 space-y-4 w-full">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Left: Photo Upload/Preview */}
                <div className="w-full md:w-48 shrink-0 flex flex-col gap-2">
                  <Label className="text-xs font-medium">Foto Komoditi</Label>
                  <div className="border-2 border-dashed rounded-lg flex items-center justify-center h-48 bg-muted/20 relative overflow-hidden group">
                    {fFoto ? (
                      <img src={URL.createObjectURL(fFoto)} alt="Preview" className="w-full h-full object-cover" />
                    ) : editing?.foto ? (
                      <img src={`${api.defaults.baseURL?.replace('/api', '')}/storage/${editing.foto}`} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-muted-foreground flex flex-col items-center">
                        <Upload className="w-6 h-6 mb-1 opacity-50" />
                        <span className="text-xs">Pilih Foto</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setFFoto(e.target.files?.[0] || null)} />
                    <div className="absolute inset-x-0 bottom-0 bg-black/50 p-1 text-[10px] text-white text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      Klik untuk ubah foto
                    </div>
                  </div>
                </div>

                {/* Right: Inputs */}
                <div className="flex-1 space-y-4 min-w-0">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Kategori Tanaman *</Label>
                      <Select 
                        value={fKategori} 
                        onValueChange={(val) => {
                          setFKategori(val || '');
                          setFNama('');
                          setIsCustomNama(false);
                        }}
                      >
                        <SelectTrigger className="w-full h-9 text-sm rounded-md"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                        <SelectContent className="min-w-max">
                          {KATEGORI_OPTIONS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 flex flex-col">
                      <Label className="text-xs font-medium">Nama Komoditi *</Label>
                      {isCustomNama ? (
                        <div className="flex gap-2 h-9 items-center">
                          <Input className="h-full text-sm rounded-md flex-1" value={fNamaTemp} onChange={e => setFNamaTemp(e.target.value)} placeholder="Ketik nama komoditi baru..." autoFocus />
                          <Button variant="default" className="h-full px-3 text-xs" onClick={() => { 
                            if (fNamaTemp.trim()) {
                              setCustomKomoditiList(prev => Array.from(new Set([...prev, fNamaTemp.trim()])));
                              setFNama(fNamaTemp.trim());
                              setIsCustomNama(false);
                            }
                          }}>
                            Set
                          </Button>
                          <Button variant="outline" className="h-full px-3 text-xs" onClick={() => { setIsCustomNama(false); setFNamaTemp(''); }}>
                            Batal
                          </Button>
                        </div>
                      ) : (
                        <Select 
                          value={(fKategori ? (PRESET_KOMODITI_MAP[fKategori] || []) : Object.values(PRESET_KOMODITI_MAP).flat()).concat(customKomoditiList).includes(fNama) ? fNama : (fNama === '' ? '' : 'lainnya')} 
                          onValueChange={v => {
                            if (v === 'lainnya') {
                              setIsCustomNama(true);
                              setFNamaTemp('');
                            } else {
                              setFNama(v || '');
                            }
                          }}
                        >
                          <SelectTrigger className="w-full h-9 text-sm rounded-md"><SelectValue placeholder="Pilih atau tambah..." /></SelectTrigger>
                          <SelectContent>
                            <div className="max-h-[200px] overflow-y-auto">
                              {Array.from(new Set([...(fKategori ? (PRESET_KOMODITI_MAP[fKategori] || []) : Object.values(PRESET_KOMODITI_MAP).flat()), ...customKomoditiList])).sort().map(k => <SelectItem key={k as string} value={k as string}>{k as string}</SelectItem>)}
                            </div>
                            <SelectItem value="lainnya" className="font-bold text-primary border-t rounded-none mt-1">
                              + Tambah Baru
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Nama Latin</Label>
                      <Input 
                        className="h-9 text-sm rounded-md" 
                        value={fLatin} 
                        onChange={e => setFLatin(e.target.value)} 
                        placeholder={isSearchingLatin ? "Mencari di Wikipedia..." : "Contoh: Solanum lycopersicum"} 
                        disabled={isSearchingLatin}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Varietas</Label>
                      <Input className="h-9 text-sm rounded-md" value={fVarietas} onChange={e => setFVarietas(e.target.value)} placeholder="Servo, Permata" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Status *</Label>
                      <Select value={fStatus} onValueChange={v => setFStatus(v || 'Aktif')}>
                        <SelectTrigger className="w-full h-9 text-sm rounded-md"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Aktif">Aktif</SelectItem>
                          <SelectItem value="Draft">Draft</SelectItem>
                          <SelectItem value="Nonaktif">Nonaktif</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 flex flex-col">
                      <Label className="text-xs font-medium">Usia Panen (Hari)</Label>
                      <Input type="number" className="h-9 text-sm rounded-md" value={fUsiaPanen} onChange={e => setFUsiaPanen(e.target.value)} placeholder="120" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 mt-4">
                <Label className="text-xs font-medium">Deskripsi</Label>
                <Textarea className="text-sm rounded-md min-h-[80px]" value={fDeskripsi} onChange={e => setFDeskripsi(e.target.value)} placeholder="Informasi tambahan" />
              </div>
            </TabsContent>

            <TabsContent value="lingkungan" className="space-y-4 mt-4 w-full">
              <p className="text-xs text-muted-foreground">Karakteristik lingkungan ideal untuk pertumbuhan tanaman.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Suhu Min (°C)</Label>
                  <Input type="number" className="h-9 text-sm rounded-md" value={fSuhuMin} onChange={e => setFSuhuMin(e.target.value)} placeholder="24" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Suhu Max (°C)</Label>
                  <Input type="number" className="h-9 text-sm rounded-md" value={fSuhuMax} onChange={e => setFSuhuMax(e.target.value)} placeholder="30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Kelembapan Udara Min (%)</Label>
                  <Input type="number" className="h-9 text-sm rounded-md" value={fKelUdaraMin} onChange={e => setFKelUdaraMin(e.target.value)} placeholder="60" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Kelembapan Udara Max (%)</Label>
                  <Input type="number" className="h-9 text-sm rounded-md" value={fKelUdaraMax} onChange={e => setFKelUdaraMax(e.target.value)} placeholder="80" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">pH Tanah Min</Label>
                  <Input type="number" step="0.1" className="h-9 text-sm rounded-md" value={fPhMin} onChange={e => setFPhMin(e.target.value)} placeholder="5.5" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">pH Tanah Max</Label>
                  <Input type="number" step="0.1" className="h-9 text-sm rounded-md" value={fPhMax} onChange={e => setFPhMax(e.target.value)} placeholder="7.0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Ketinggian Min (mdpl)</Label>
                  <Input type="number" className="h-9 text-sm rounded-md" value={fKetinggianMin} onChange={e => setFKetinggianMin(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Ketinggian Max (mdpl)</Label>
                  <Input type="number" className="h-9 text-sm rounded-md" value={fKetinggianMax} onChange={e => setFKetinggianMax(e.target.value)} placeholder="1000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Jenis Tanah</Label>
                  <Input className="h-9 text-sm rounded-md" value={fJenisTanah} onChange={e => setFJenisTanah(e.target.value)} placeholder="Lempung berpasir" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Drainase</Label>
                  <Select value={fDrainase} onValueChange={v => setFDrainase(v || '')}>
                    <SelectTrigger className="w-full h-9 text-sm rounded-md"><SelectValue placeholder="Pilih" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baik">Baik</SelectItem>
                      <SelectItem value="Sedang">Sedang</SelectItem>
                      <SelectItem value="Buruk">Buruk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="hama" className="space-y-4 mt-4 w-full">
              <p className="text-xs text-muted-foreground">Pilih jenis hama dan penyakit yang umum menyerang komoditi ini.</p>
              
              <div className="space-y-1.5 flex flex-col">
                <Label className="text-xs font-medium">Jenis Hama</Label>
                {isCustomHama ? (
                  <div className="flex gap-2 h-9 items-center">
                    <Input className="h-full text-sm rounded-md flex-1" value={fJenisHamaTemp} onChange={e => setFJenisHamaTemp(e.target.value)} placeholder="Ketik jenis hama baru (bisa dipisah koma)..." autoFocus />
                    <Button variant="default" className="h-full px-3 text-xs" onClick={() => { 
                      if (fJenisHamaTemp.trim()) {
                        setCustomHamaList(prev => Array.from(new Set([...prev, fJenisHamaTemp.trim()])));
                        setFJenisHama(fJenisHamaTemp.trim());
                        setIsCustomHama(false);
                      }
                    }}>Set</Button>
                    <Button variant="outline" className="h-full px-3 text-xs" onClick={() => { setIsCustomHama(false); setFJenisHamaTemp(''); }}>Batal</Button>
                  </div>
                ) : (
                  <Select 
                    value={PRESET_HAMA.concat(customHamaList).includes(fJenisHama) ? fJenisHama : (fJenisHama === '' ? '' : 'lainnya')} 
                    onValueChange={v => {
                      if (v === 'lainnya') {
                        setIsCustomHama(true);
                        setFJenisHamaTemp('');
                      } else {
                        setFJenisHama(v || '');
                      }
                    }}
                  >
                    <SelectTrigger className="w-full h-9 text-sm rounded-md"><SelectValue placeholder="Pilih atau tambah..." /></SelectTrigger>
                    <SelectContent className="min-w-[280px] sm:min-w-max">
                      <div className="max-h-[200px] overflow-y-auto">
                        {Array.from(new Set([...PRESET_HAMA, ...customHamaList])).sort().map(k => <SelectItem key={k as string} value={k as string}>{k as string}</SelectItem>)}
                      </div>
                      <SelectItem value="lainnya" className="font-bold text-primary border-t rounded-none mt-1">+ Tambah Baru</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5 flex flex-col">
                <Label className="text-xs font-medium">Jenis Penyakit</Label>
                {isCustomPenyakit ? (
                  <div className="flex gap-2 h-9 items-center">
                    <Input className="h-full text-sm rounded-md flex-1" value={fJenisPenyakitTemp} onChange={e => setFJenisPenyakitTemp(e.target.value)} placeholder="Ketik jenis penyakit baru (bisa dipisah koma)..." autoFocus />
                    <Button variant="default" className="h-full px-3 text-xs" onClick={() => { 
                      if (fJenisPenyakitTemp.trim()) {
                        setCustomPenyakitList(prev => Array.from(new Set([...prev, fJenisPenyakitTemp.trim()])));
                        setFJenisPenyakit(fJenisPenyakitTemp.trim());
                        setIsCustomPenyakit(false);
                      }
                    }}>Set</Button>
                    <Button variant="outline" className="h-full px-3 text-xs" onClick={() => { setIsCustomPenyakit(false); setFJenisPenyakitTemp(''); }}>Batal</Button>
                  </div>
                ) : (
                  <Select 
                    value={PRESET_PENYAKIT.concat(customPenyakitList).includes(fJenisPenyakit) ? fJenisPenyakit : (fJenisPenyakit === '' ? '' : 'lainnya')} 
                    onValueChange={v => {
                      if (v === 'lainnya') {
                        setIsCustomPenyakit(true);
                        setFJenisPenyakitTemp('');
                      } else {
                        setFJenisPenyakit(v || '');
                      }
                    }}
                  >
                    <SelectTrigger className="w-full h-9 text-sm rounded-md"><SelectValue placeholder="Pilih atau tambah..." /></SelectTrigger>
                    <SelectContent className="min-w-[280px] sm:min-w-max">
                      <div className="max-h-[200px] overflow-y-auto">
                        {Array.from(new Set([...PRESET_PENYAKIT, ...customPenyakitList])).sort().map(k => <SelectItem key={k as string} value={k as string}>{k as string}</SelectItem>)}
                      </div>
                      <SelectItem value="lainnya" className="font-bold text-primary border-t rounded-none mt-1">+ Tambah Baru</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </TabsContent>

            <TabsContent value="siklus" className="space-y-4 mt-4 w-full">
              <p className="text-xs text-muted-foreground">Informasi rentang usia panen dan fase pertumbuhan.</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Usia Tanam Min</Label>
                  <Input type="number" className="h-9 text-sm rounded-md" value={fUsiaMin} onChange={e => setFUsiaMin(e.target.value)} placeholder="Misal: 100" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Usia Tanam Max</Label>
                  <Input type="number" className="h-9 text-sm rounded-md" value={fUsiaMax} onChange={e => setFUsiaMax(e.target.value)} placeholder="Misal: 120" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Satuan Usia</Label>
                  <Select value={fSatuanUsia} onValueChange={v => setFSatuanUsia(v || 'hari')}>
                    <SelectTrigger className="w-full h-9 text-sm rounded-md"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hari">Hari</SelectItem>
                      <SelectItem value="minggu">Minggu</SelectItem>
                      <SelectItem value="bulan">Bulan</SelectItem>
                      <SelectItem value="tahun">Tahun</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Fase Pembibitan</Label>
                  <Input className="h-9 text-sm rounded-md" value={fPembibitan} onChange={e => setFPembibitan(e.target.value)} placeholder="Misal: 0-21 hari" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Fase Vegetatif</Label>
                  <Input className="h-9 text-sm rounded-md" value={fVegetatif} onChange={e => setFVegetatif(e.target.value)} placeholder="Misal: 22-60 hari" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Fase Generatif</Label>
                  <Input className="h-9 text-sm rounded-md" value={fGeneratif} onChange={e => setFGeneratif(e.target.value)} placeholder="Misal: 61-100 hari" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Fase Panen</Label>
                  <Input className="h-9 text-sm rounded-md" value={fPanen} onChange={e => setFPanen(e.target.value)} placeholder="Misal: 100-120 hari" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Catatan Budidaya / Panen</Label>
                <Textarea className="text-sm rounded-md min-h-[60px]" value={fCatatanBudidaya} onChange={e => setFCatatanBudidaya(e.target.value)} placeholder="Misal: Panen dilakukan saat bulir menguning." />
              </div>
            </TabsContent>

            <TabsContent value="nutrisi" className="space-y-4 mt-4 w-full">
              <p className="text-xs text-muted-foreground">Informasi kebutuhan nutrisi utama tanaman (N, P, K) dan organik.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nitrogen Min (ppm/ha)</Label>
                  <Input type="number" step="0.01" className="h-9 text-sm rounded-md" value={fNitrogenMin} onChange={e => setFNitrogenMin(e.target.value)} placeholder="0.2" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nitrogen Max (ppm/ha)</Label>
                  <Input type="number" step="0.01" className="h-9 text-sm rounded-md" value={fNitrogenMax} onChange={e => setFNitrogenMax(e.target.value)} placeholder="0.5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Fosfor Min (ppm/ha)</Label>
                  <Input type="number" step="0.1" className="h-9 text-sm rounded-md" value={fFosforMin} onChange={e => setFFosforMin(e.target.value)} placeholder="10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Fosfor Max (ppm/ha)</Label>
                  <Input type="number" step="0.1" className="h-9 text-sm rounded-md" value={fFosforMax} onChange={e => setFFosforMax(e.target.value)} placeholder="25" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Kalium Min (ppm/ha)</Label>
                  <Input type="number" step="0.1" className="h-9 text-sm rounded-md" value={fKaliumMin} onChange={e => setFKaliumMin(e.target.value)} placeholder="80" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Kalium Max (ppm/ha)</Label>
                  <Input type="number" step="0.1" className="h-9 text-sm rounded-md" value={fKaliumMax} onChange={e => setFKaliumMax(e.target.value)} placeholder="150" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Bahan Organik Min (%)</Label>
                  <Input type="number" step="0.1" className="h-9 text-sm rounded-md" value={fOrganikMin} onChange={e => setFOrganikMin(e.target.value)} placeholder="2.0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Bahan Organik Max (%)</Label>
                  <Input type="number" step="0.1" className="h-9 text-sm rounded-md" value={fOrganikMax} onChange={e => setFOrganikMax(e.target.value)} placeholder="5.0" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Rekomendasi Pemupukan Default</Label>
                <Textarea className="text-sm rounded-md min-h-[60px]" value={fRekPemupukan} onChange={e => setFRekPemupukan(e.target.value)} placeholder="Gunakan pupuk organik dan NPK seimbang..." />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" className="rounded-md text-sm" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button className="rounded-md text-sm gap-2" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CommodityForm;
