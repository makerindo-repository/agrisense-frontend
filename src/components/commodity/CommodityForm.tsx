import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Save, Sprout, Thermometer, Bug, Calendar, HeartPulse } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from "@/components/ui/button";
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import api from '../../lib/api';
import { getStorageUrl } from '../../utils/fileUtils';

import {
  KATEGORI_OPTIONS,
  PRESET_KOMODITI_MAP,
  PRESET_HAMA,
  PRESET_PENYAKIT
} from '../../constants/commodityConstants';

export interface CommodityFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editing: any | null; // Komoditi type
  onSaveSuccess: () => void;
}

const CommodityForm: React.FC<CommodityFormProps> = ({ isOpen, onOpenChange, editing, onSaveSuccess }) => {
  const { t } = useTranslation();
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
  };

  const availableCommodities = React.useMemo(() => {
    let base: string[] = [];
    if (fKategori) {
      const catLower = fKategori.toLowerCase();
      for (const [key, val] of Object.entries(PRESET_KOMODITI_MAP)) {
        const keyLower = key.toLowerCase();
        const mainWord = keyLower.split(' ')[0];
        if (keyLower.includes(catLower) || catLower.includes(mainWord)) {
          base = val;
          break;
        }
      }
    }
    if (base.length === 0) {
      base = Object.values(PRESET_KOMODITI_MAP).flat();
    }
    const set = new Set([...base, ...customKomoditiList]);
    if (fNama) set.add(fNama);
    return Array.from(set).filter(Boolean).sort();
  }, [fKategori, customKomoditiList, fNama]);

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        const k = editing;
        setFNama(k.nama_komoditi || '');
        if (k.nama_komoditi) {
          setCustomKomoditiList(prev => Array.from(new Set([...prev, k.nama_komoditi])));
        }
        setIsCustomNama(false);
        setFKategori(k.kategori_tanaman || '');
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
        setFormTab('dasar');
      } else {
        resetForm();
      }
    }
  }, [isOpen, editing]);

  const handleSave = async () => {
    if (!fNama || !fKategori) {
      toast.error(t('Nama komoditi dan kategori wajib diisi!'));
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

      if (editing) {
        formData.append('_method', 'PUT');
        await api.post(`/komoditi/${editing.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(t('Komoditi berhasil diperbarui!'));
      } else {
        await api.post('/komoditi', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(t('Komoditi berhasil ditambahkan!'));
      }
      onOpenChange(false);
      resetForm();
      onSaveSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Gagal menyimpan komoditi'));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = "w-full rounded-2xl h-11 px-4 border-border/80 bg-muted/20 font-semibold text-xs focus:bg-background focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  const renderUnitInput = (
    value: string, 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, 
    placeholder: string, 
    unit?: string,
    step?: string
  ) => (
    <div className="relative flex items-center w-full">
      <Input 
        type="number" 
        step={step}
        className={`${inputStyle} ${unit ? 'pr-12' : ''}`} 
        value={value} 
        onChange={onChange} 
        placeholder={placeholder} 
      />
      {unit && (
        <span className="absolute right-4 text-xs font-bold text-muted-foreground/70 pointer-events-none select-none">
          {unit}
        </span>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-[28px] border border-border/80 shadow-2xl bg-card gap-0">
        <DialogHeader className="p-6 sm:p-7 pb-5 border-b border-border/60 bg-muted/20 flex flex-row items-center gap-4 space-y-0 text-left shrink-0">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 shadow-xs">
            <Sprout size={22} />
          </div>
          <div className="flex flex-col gap-1 pr-6">
            <DialogTitle className="text-xl font-black tracking-tight text-foreground leading-snug">
              {editing ? t('Edit Komoditi') : t('Tambah Komoditi Baru')}
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
              {editing?.is_system ? t('Data bawaan sistem — beberapa parameter dilindungi.') : t('Isi informasi lengkap komoditi tanaman dan karakteristik budidaya.')}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 sm:p-7">
          <Tabs value={formTab} onValueChange={setFormTab} className="w-full flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-52 shrink-0">
              <TabsList className="flex flex-col w-full h-auto bg-muted/30 p-1.5 gap-1 rounded-2xl border border-border/60">
                <TabsTrigger value="dasar" className="w-full justify-start text-left px-3.5 py-3 text-xs font-bold rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-xs gap-2.5">
                  <Sprout size={15} className="text-emerald-500" />
                  {t('Info Dasar')}
                </TabsTrigger>
                <TabsTrigger value="lingkungan" className="w-full justify-start text-left px-3.5 py-3 text-xs font-bold rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-xs gap-2.5">
                  <Thermometer size={15} className="text-amber-500" />
                  {t('Lingkungan')}
                </TabsTrigger>
                <TabsTrigger value="hama" className="w-full justify-start text-left px-3.5 py-3 text-xs font-bold rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-xs gap-2.5">
                  <Bug size={15} className="text-rose-500" />
                  {t('Hama dan Penyakit')}
                </TabsTrigger>
                <TabsTrigger value="siklus" className="w-full justify-start text-left px-3.5 py-3 text-xs font-bold rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-xs gap-2.5">
                  <Calendar size={15} className="text-teal-500" />
                  {t('Siklus Tanam')}
                </TabsTrigger>
                <TabsTrigger value="nutrisi" className="w-full justify-start text-left px-3.5 py-3 text-xs font-bold rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-xs gap-2.5">
                  <HeartPulse size={15} className="text-indigo-500" />
                  {t('Nutrisi')}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 min-w-0 w-full pt-1">
              <TabsContent value="dasar" className="m-0 space-y-5">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Left: Photo Upload */}
                  <div className="w-full md:w-44 shrink-0 flex flex-col gap-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Foto Komoditi')}</Label>
                    <div className="border-2 border-dashed border-border/80 rounded-2xl flex items-center justify-center h-44 bg-muted/20 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
                      {fFoto ? (
                        <img src={URL.createObjectURL(fFoto)} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
                      ) : editing?.foto ? (
                        <img src={getStorageUrl(editing.foto)} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        <div className="text-center text-muted-foreground flex flex-col items-center p-4">
                          <Upload className="w-6 h-6 mb-2 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-[11px] font-bold">{t('Pilih Foto')}</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setFFoto(e.target.files?.[0] || null)} />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 text-[10px] font-bold text-white text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {t('Klik untuk ubah foto')}
                      </div>
                    </div>
                  </div>

                  {/* Right: Inputs */}
                  <div className="flex-1 space-y-4 min-w-0">
                    <div className="space-y-2">
                      <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                        {t('Kategori Tanaman')} <span className="text-rose-500">*</span>
                      </Label>
                      <select 
                        value={fKategori} 
                        onChange={(e) => {
                          setFKategori(e.target.value || '');
                          setFNama('');
                          setIsCustomNama(false);
                        }}
                        className={`${inputStyle} cursor-pointer`}
                      >
                        <option value="" className="bg-card text-foreground">-- {t('Pilih Kategori')} --</option>
                        {KATEGORI_OPTIONS.map(k => <option key={k} value={k} className="text-xs font-bold py-2 bg-card text-foreground">{k}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                        {t('Nama Komoditi')} <span className="text-rose-500">*</span>
                      </Label>
                      {isCustomNama ? (
                        <div className="flex gap-2 items-center">
                          <Input className={inputStyle} value={fNamaTemp} onChange={e => setFNamaTemp(e.target.value)} placeholder={t('Ketik nama komoditi baru...')} autoFocus />
                          <Button variant="default" className="h-11 px-4 text-xs font-extrabold rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { 
                            if (fNamaTemp.trim()) {
                              setCustomKomoditiList(prev => Array.from(new Set([...prev, fNamaTemp.trim()])));
                              setFNama(fNamaTemp.trim());
                              setIsCustomNama(false);
                            }
                          }}>
                            {t('Set')}
                          </Button>
                          <Button variant="outline" className="h-11 px-4 text-xs font-extrabold rounded-2xl" onClick={() => { setIsCustomNama(false); setFNamaTemp(''); }}>
                            {t('Batal')}
                          </Button>
                        </div>
                      ) : (
                        <select 
                          value={availableCommodities.includes(fNama) ? fNama : (fNama === '' ? '' : 'lainnya')} 
                          onChange={e => {
                            const v = e.target.value;
                            if (v === 'lainnya') {
                              setIsCustomNama(true);
                              setFNamaTemp('');
                            } else {
                              setFNama(v || '');
                            }
                          }}
                          className={`${inputStyle} cursor-pointer`}
                        >
                          <option value="" className="bg-card text-foreground">-- {t('Pilih Komoditi')} --</option>
                          {availableCommodities.map(k => (
                            <option key={k} value={k} className="text-xs font-bold py-2 bg-card text-foreground">
                              {k}
                            </option>
                          ))}
                          <option value="lainnya" className="text-xs font-extrabold text-emerald-600 bg-card">
                            + {t('Ketik Tambah Baru')}
                          </option>
                        </select>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Nama Latin')}</Label>
                        <Input className={inputStyle} value={fLatin} onChange={e => setFLatin(e.target.value)} placeholder="Solanum lycopersicum" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Varietas')}</Label>
                        <Input className={inputStyle} value={fVarietas} onChange={e => setFVarietas(e.target.value)} placeholder="Servo, Permata" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Status')}</Label>
                        <select 
                          value={fStatus} 
                          onChange={e => setFStatus(e.target.value || 'Aktif')}
                          className={`${inputStyle} cursor-pointer`}
                        >
                          <option value="Aktif" className="text-xs font-bold py-2 bg-card text-foreground">{t('Aktif')}</option>
                          <option value="Draft" className="text-xs font-bold py-2 bg-card text-foreground">Draft</option>
                          <option value="Nonaktif" className="text-xs font-bold py-2 bg-card text-foreground">{t('Nonaktif')}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Usia Panen')}</Label>
                        {renderUnitInput(fUsiaPanen, e => setFUsiaPanen(e.target.value), "120", "HARI")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Deskripsi')}</Label>
                  <Textarea className="w-full rounded-2xl p-4 border-border/80 bg-muted/20 font-semibold text-xs focus:bg-background focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-xs min-h-[90px]" value={fDeskripsi} onChange={e => setFDeskripsi(e.target.value)} placeholder={t('Informasi tambahan komoditi')} />
                </div>
              </TabsContent>

              <TabsContent value="lingkungan" className="m-0 space-y-5">
                <p className="text-xs font-bold text-muted-foreground mb-1">{t('Karakteristik lingkungan ideal untuk pertumbuhan tanaman.')}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Suhu Min')}</Label>
                    {renderUnitInput(fSuhuMin, e => setFSuhuMin(e.target.value), "24", "°C")}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Suhu Max')}</Label>
                    {renderUnitInput(fSuhuMax, e => setFSuhuMax(e.target.value), "30", "°C")}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Kelembapan Udara Min')}</Label>
                    {renderUnitInput(fKelUdaraMin, e => setFKelUdaraMin(e.target.value), "60", "%")}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Kelembapan Udara Max')}</Label>
                    {renderUnitInput(fKelUdaraMax, e => setFKelUdaraMax(e.target.value), "80", "%")}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('pH Tanah Min')}</Label>
                    {renderUnitInput(fPhMin, e => setFPhMin(e.target.value), "5.5", undefined, "0.1")}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('pH Tanah Max')}</Label>
                    {renderUnitInput(fPhMax, e => setFPhMax(e.target.value), "7.0", undefined, "0.1")}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Ketinggian Min')}</Label>
                    {renderUnitInput(fKetinggianMin, e => setFKetinggianMin(e.target.value), "0", "MDPL")}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Ketinggian Max')}</Label>
                    {renderUnitInput(fKetinggianMax, e => setFKetinggianMax(e.target.value), "1000", "MDPL")}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Jenis Tanah')}</Label>
                    <Input className={inputStyle} value={fJenisTanah} onChange={e => setFJenisTanah(e.target.value)} placeholder="Lempung berpasir" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Drainase')}</Label>
                    <select
                      value={fDrainase}
                      onChange={e => setFDrainase(e.target.value || '')}
                      className={`${inputStyle} cursor-pointer`}
                    >
                      <option value="" className="bg-card text-foreground">-- {t('Pilih Drainase')} --</option>
                      <option value="Baik" className="text-xs font-bold py-2 bg-card text-foreground">Baik</option>
                      <option value="Sedang" className="text-xs font-bold py-2 bg-card text-foreground">Sedang</option>
                      <option value="Buruk" className="text-xs font-bold py-2 bg-card text-foreground">Buruk</option>
                    </select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="hama" className="m-0 space-y-5">
                <p className="text-xs font-bold text-muted-foreground mb-1">{t('Pilih jenis hama dan penyakit yang umum menyerang komoditi ini.')}</p>
                <div className="space-y-2">
                  <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Jenis Hama')}</Label>
                  <Input className={inputStyle} value={fJenisHama} onChange={e => setFJenisHama(e.target.value)} placeholder="Ulat Grayak, Kutu Daun" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Jenis Penyakit')}</Label>
                  <Input className={inputStyle} value={fJenisPenyakit} onChange={e => setFJenisPenyakit(e.target.value)} placeholder="Layu Fusarium, Antraknosa" />
                </div>
              </TabsContent>

              <TabsContent value="siklus" className="m-0 space-y-5">
                <p className="text-xs font-bold text-muted-foreground mb-1">{t('Informasi rentang usia panen dan fase pertumbuhan.')}</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Usia Tanam Min')}</Label>
                    {renderUnitInput(fUsiaMin, e => setFUsiaMin(e.target.value), "100", fSatuanUsia.toUpperCase())}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Usia Tanam Max')}</Label>
                    {renderUnitInput(fUsiaMax, e => setFUsiaMax(e.target.value), "120", fSatuanUsia.toUpperCase())}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Satuan Usia')}</Label>
                    <select
                      value={fSatuanUsia}
                      onChange={e => setFSatuanUsia(e.target.value || 'hari')}
                      className={`${inputStyle} cursor-pointer`}
                    >
                      <option value="hari" className="text-xs font-bold py-2 bg-card text-foreground">Hari</option>
                      <option value="minggu" className="text-xs font-bold py-2 bg-card text-foreground">Minggu</option>
                      <option value="bulan" className="text-xs font-bold py-2 bg-card text-foreground">Bulan</option>
                      <option value="tahun" className="text-xs font-bold py-2 bg-card text-foreground">Tahun</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Fase Pembibitan')}</Label>
                    <Input className={inputStyle} value={fPembibitan} onChange={e => setFPembibitan(e.target.value)} placeholder="0-21 hari" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Fase Vegetatif')}</Label>
                    <Input className={inputStyle} value={fVegetatif} onChange={e => setFVegetatif(e.target.value)} placeholder="22-60 hari" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Fase Generatif')}</Label>
                    <Input className={inputStyle} value={fGeneratif} onChange={e => setFGeneratif(e.target.value)} placeholder="61-100 hari" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Fase Panen')}</Label>
                    <Input className={inputStyle} value={fPanen} onChange={e => setFPanen(e.target.value)} placeholder="100-120 hari" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Catatan Budidaya')}</Label>
                  <Textarea className="w-full rounded-2xl p-4 border-border/80 bg-muted/20 font-semibold text-xs focus:bg-background focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-xs min-h-[80px]" value={fCatatanBudidaya} onChange={e => setFCatatanBudidaya(e.target.value)} placeholder="Panen dilakukan saat bulir menguning." />
                </div>
              </TabsContent>

              <TabsContent value="nutrisi" className="m-0 space-y-5">
                <p className="text-xs font-bold text-muted-foreground mb-1">{t('Informasi kebutuhan nutrisi utama tanaman (N, P, K) dan organik.')}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Nitrogen Min')}</Label>
                    {renderUnitInput(fNitrogenMin, e => setFNitrogenMin(e.target.value), "0.2", "PPM", "0.01")}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Nitrogen Max')}</Label>
                    {renderUnitInput(fNitrogenMax, e => setFNitrogenMax(e.target.value), "0.5", "PPM", "0.01")}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Fosfor Min')}</Label>
                    {renderUnitInput(fFosforMin, e => setFFosforMin(e.target.value), "10", "PPM", "0.1")}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Fosfor Max')}</Label>
                    {renderUnitInput(fFosforMax, e => setFFosforMax(e.target.value), "25", "PPM", "0.1")}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Kalium Min')}</Label>
                    {renderUnitInput(fKaliumMin, e => setFKaliumMin(e.target.value), "80", "PPM", "0.1")}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Kalium Max')}</Label>
                    {renderUnitInput(fKaliumMax, e => setFKaliumMax(e.target.value), "150", "PPM", "0.1")}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Bahan Organik Min')}</Label>
                    {renderUnitInput(fOrganikMin, e => setFOrganikMin(e.target.value), "2.0", "%", "0.1")}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Bahan Organik Max')}</Label>
                    {renderUnitInput(fOrganikMax, e => setFOrganikMax(e.target.value), "5.0", "%", "0.1")}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">{t('Rekomendasi Pemupukan')}</Label>
                  <Textarea className="w-full rounded-2xl p-4 border-border/80 bg-muted/20 font-semibold text-xs focus:bg-background focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-xs min-h-[80px]" value={fRekPemupukan} onChange={e => setFRekPemupukan(e.target.value)} placeholder="Gunakan pupuk organik dan NPK seimbang..." />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 sm:px-8 sm:py-5 border-t border-border/60 bg-muted/30 flex flex-row items-center justify-end gap-3 shrink-0 rounded-b-[28px] space-x-0">
          <Button 
            type="button" 
            variant="outline" 
            className="h-11 px-6 rounded-2xl border-border/80 font-extrabold text-xs bg-card hover:bg-muted transition-all cursor-pointer m-0" 
            onClick={() => onOpenChange(false)}
          >
            {t('Batal')}
          </Button>
          <Button 
            type="button" 
            className="h-11 px-7 rounded-2xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-all cursor-pointer gap-2 m-0" 
            onClick={handleSave} 
            disabled={saving}
          >
            <Save size={16} />
            {saving ? t('Menyimpan...') : editing ? t('Simpan Perubahan') : t('Tambah Komoditi')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CommodityForm;
