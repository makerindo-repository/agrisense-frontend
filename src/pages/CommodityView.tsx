import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit, Trash2, Save, X, Leaf, ChevronLeft, ChevronRight, Eye, Upload, Sprout, FlaskConical, Bug, Thermometer, Droplets, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import api from '../lib/api';
import { getStorageUrl } from '../utils/fileUtils';

import CommodityForm from '../components/commodity/CommodityForm';
import CommodityDetail from '../components/commodity/CommodityDetail';

export interface Komoditi {
  id: number;
  kode_komoditi: string;
  nama_komoditi: string;
  kategori_tanaman: string;
  nama_latin?: string;
  varietas?: string;
  deskripsi?: string;
  status: string;
  fapar?: number;
  epsilon_max?: number;
  is_system: boolean;
  foto?: string;
  lingkungan?: any;
  hama_penyakit?: any[];
  sensor?: any;
  fase_tanam?: any;
  nutrisi?: any;
  rekomendasi?: any;
}

import { KATEGORI_OPTIONS } from '../constants/commodityConstants';

const PER_PAGE = 10;

const CommodityView = React.memo(({ userRole }: { userRole?: string }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<Komoditi[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [isSearchingLatin, setIsSearchingLatin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Komoditi | null>(null);
  const [formTab, setFormTab] = useState('dasar');
  const [deleteTarget, setDeleteTarget] = useState<Komoditi | null>(null);
  const [detailTarget, setDetailTarget] = useState<Komoditi | null>(null);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/komoditi');
      const rawData = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.komoditi || res.data?.items || []);
      if (Array.isArray(rawData)) {
        setData(rawData);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error('Failed to fetch komoditi', e);
      toast.error(t('Gagal memuat data komoditi'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Filter + search
  const filtered = useMemo(() => {
    return data.filter(k => {
      const matchSearch = !searchQuery || 
        k.nama_komoditi.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.kode_komoditi.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (k.nama_latin || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.kategori_tanaman.toLowerCase().includes(searchQuery.toLowerCase());
      const matchKategori = !filterKategori || filterKategori === '__all__' || k.kategori_tanaman === filterKategori;
      const matchStatus = !filterStatus || filterStatus === '__all__' || k.status === filterStatus;
      return matchSearch && matchKategori && matchStatus;
    });
  }, [data, searchQuery, filterKategori, filterStatus]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => { setPage(1); }, [searchQuery, filterKategori, filterStatus]);

  // Stats
  const totalAktif = data.filter(k => k.status === 'Aktif').length;
  const totalDraft = data.filter(k => k.status === 'Draft').length;
  const totalKategori = new Set(data.map(k => k.kategori_tanaman)).size;

  const openAdd = () => {
    setEditing(null);
    setIsFormOpen(true);
  };

  const openEdit = (k: Komoditi) => {
    setEditing(k);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/komoditi/${deleteTarget.id}`);
      toast.success(t('Komoditi berhasil dihapus'));
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('Gagal menghapus komoditi'));
      setDeleteTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRange = (min: any, max: any, unit?: string) => {
    if (min == null && max == null) return '-';
    const suffix = unit ? ` ${unit}` : '';
    if (min != null && max != null) return `${min}–${max}${suffix}`;
    if (min != null) return `≥${min}${suffix}`;
    return `≤${max}${suffix}`;
  };

  return (
    <div className="w-full space-y-6 max-w-6xl mx-auto pb-24 select-none block">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/60 pb-4 w-full">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs shrink-0">
            <Sprout size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">{t('Manajemen Komoditi')}</h1>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">{t('Pengelolaan data komoditi pertanian dan karakteristik budidaya')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {userRole !== 'viewer' && (
            <Button 
              className="h-11 px-6 rounded-2xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-all cursor-pointer gap-2" 
              onClick={openAdd}
            >
              <Plus size={16} /> {t('Tambah Komoditi')}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">{t("Total Komoditi")}</span>
            <span className="text-3xl font-black tracking-tight text-foreground">{data.length}</span>
            <span className="text-[11px] font-semibold text-muted-foreground">{t("Jenis Tanaman Terdaftar")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <Sprout size={24} />
          </div>
        </div>

        <div className="bg-card p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t("Aktif")}</span>
            <span className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">{totalAktif}</span>
            <span className="text-[11px] font-semibold text-emerald-700/80 dark:text-emerald-400/80">{t("Siap Dibudidayakan")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <Leaf size={24} />
          </div>
        </div>

        <div className="bg-card p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider">{t("Draft")}</span>
            <span className="text-3xl font-black tracking-tight text-amber-600 dark:text-amber-400">{totalDraft}</span>
            <span className="text-[11px] font-semibold text-amber-700/80 dark:text-amber-400/80">{t("Perlu Dilengkapi")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
            <FlaskConical size={24} />
          </div>
        </div>

        <div className="bg-card p-5 rounded-[24px] shadow-sm border border-border/80 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{t("Kategori")}</span>
            <span className="text-3xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">{totalKategori}</span>
            <span className="text-[11px] font-semibold text-indigo-700/80 dark:text-indigo-400/80">{t("Jenis Kategori Tanaman")}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
            <Bug size={24} />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-2xl shadow-sm border border-border/80">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder={t("Cari komoditi, kode, atau nama latin...")}
            className="pl-10 bg-muted/20 border-border/60 focus:bg-background h-11 rounded-2xl font-semibold text-xs transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={18} className="text-muted-foreground shrink-0" />
          <Select value={filterKategori} onValueChange={(v) => setFilterKategori(v || '__all__')}>
            <SelectTrigger className="w-full sm:w-[220px] h-11 bg-muted/20 border-border/60 focus:bg-background rounded-2xl font-bold text-xs">
              <SelectValue>
                {filterKategori && filterKategori !== '__all__' ? filterKategori : t('Semua Kategori')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/80 shadow-2xl">
              <SelectItem value="__all__" className="font-bold text-xs">{t("Semua Kategori")}</SelectItem>
              {KATEGORI_OPTIONS.map(k => <SelectItem key={k} value={k} className="font-bold text-xs">{k}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v || '__all__')}>
            <SelectTrigger className="w-full sm:w-[160px] h-11 bg-muted/20 border-border/60 focus:bg-background rounded-2xl font-bold text-xs">
              <SelectValue>
                {filterStatus === 'Aktif' ? t('Aktif') : filterStatus === 'Draft' ? 'Draft' : filterStatus === 'Nonaktif' ? t('Nonaktif') : t('Semua Status')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/80 shadow-2xl">
              <SelectItem value="__all__" className="font-bold text-xs">{t("Semua Status")}</SelectItem>
              <SelectItem value="Aktif" className="font-bold text-xs">{t("Aktif")}</SelectItem>
              <SelectItem value="Draft" className="font-bold text-xs">Draft</SelectItem>
              <SelectItem value="Nonaktif" className="font-bold text-xs">{t("Nonaktif")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
        <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-black text-xs px-3 py-1 rounded-full">
              {filtered.length} {t('Komoditi Ditemukan')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40 border-b border-border/60">
                <TableRow>
                  <TableHead className="pl-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('Kode')}</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('Jenis Tanaman')}</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('Kategori')}</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('Suhu Ideal')}</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('pH Ideal')}</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('Usia Panen')}</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('Hama Utama')}</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('Status')}</TableHead>
                  {userRole !== 'viewer' && <TableHead className="text-right pr-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('Aksi')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/50">
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-16 text-muted-foreground text-xs font-bold">{t('Memuat data...')}</TableCell></TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search size={32} className="opacity-20" />
                        <p className="font-bold text-sm">{t('Tidak ada data komoditi ditemukan')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginated.map(k => {
                  const lg = k.lingkungan;
                  const hamas = (k.hama_penyakit || []).filter(h => h.jenis === 'Hama').map(h => h.nama).join(', ');
                  return (
                    <TableRow key={k.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <span className="text-xs font-mono font-bold text-muted-foreground">{k.kode_komoditi}</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          {k.foto ? (
                            <img src={getStorageUrl(k.foto)} alt={k.nama_komoditi} className="w-9 h-9 rounded-xl object-cover border border-border/80 shrink-0 shadow-xs" />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 font-bold text-xs">
                              <Sprout size={16} />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold text-xs text-foreground">{k.nama_komoditi}</span>
                            {k.nama_latin && <span className="text-[11px] italic font-semibold text-muted-foreground">{k.nama_latin}</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge className={cn(
                          "rounded-xl font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-0.5 border-none",
                          k.kategori_tanaman.includes('Pangan') ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                          k.kategori_tanaman.includes('Hortikultura') ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                          k.kategori_tanaman.includes('Buah') ? "bg-orange-500/15 text-orange-700 dark:text-orange-400" :
                          k.kategori_tanaman.includes('Perkebunan') ? "bg-teal-500/15 text-teal-700 dark:text-teal-400" :
                          k.kategori_tanaman.includes('Obat') ? "bg-purple-500/15 text-purple-700 dark:text-purple-400" :
                          "bg-slate-500/15 text-slate-700 dark:text-slate-400"
                        )}>
                          {k.kategori_tanaman.replace(/ \(.*?\)/g, '')}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-1.5">
                          <Thermometer size={13} className="text-rose-400 shrink-0" />
                          <span className="text-xs font-semibold text-muted-foreground">{lg ? formatRange(lg.suhu_min, lg.suhu_max, '°C') : '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-xs font-semibold text-muted-foreground">{lg ? formatRange(lg.ph_min, lg.ph_max) : '-'}</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-xs font-semibold text-muted-foreground">{k.fase_tanam ? formatRange(k.fase_tanam.usia_tanam_min, k.fase_tanam.usia_tanam_max, k.fase_tanam.satuan_usia) : '-'}</span>
                      </TableCell>
                      <TableCell className="py-4 max-w-[180px]">
                        <span className="text-xs font-semibold text-muted-foreground truncate block" title={hamas}>{hamas || '-'}</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge className={cn(
                          "rounded-xl font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-0.5 border-none",
                          k.status === 'Aktif' ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                          k.status === 'Draft' ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                          "bg-slate-500/15 text-slate-700 dark:text-slate-400"
                        )}>
                          {k.status}
                        </Badge>
                      </TableCell>
                      {userRole !== 'viewer' && (
                        <TableCell className="text-right pr-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              size="icon" 
                              variant="outline"
                              className="h-8.5 w-8.5 rounded-xl border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer shadow-xs transition-all" 
                              onClick={() => setDetailTarget(k)} 
                              title={t('Lihat Detail')}
                            >
                              <Eye size={14} />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="outline"
                              className="h-8.5 w-8.5 rounded-xl border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shadow-xs transition-all" 
                              onClick={() => openEdit(k)} 
                              title={t('Edit')}
                            >
                              <Edit size={14} />
                            </Button>
                              <Button 
                                size="icon" 
                                variant="outline"
                                className="h-8.5 w-8.5 rounded-xl border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 cursor-pointer shadow-xs transition-all" 
                                onClick={() => setDeleteTarget(k)} 
                                title={t('Hapus')}
                              >
                                <Trash2 size={14} />
                              </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/60 text-xs text-muted-foreground font-semibold bg-muted/20">
            <span>{t('Menampilkan')} {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE, filtered.length)} {t('dari')} {filtered.length} {t('data')}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-xl" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={16} />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <Button key={p} variant={page === p ? "default" : "outline"} size="sm" className={cn("h-8 w-8 p-0 text-xs rounded-xl font-bold", page === p && "bg-emerald-600 hover:bg-emerald-700")} onClick={() => setPage(p)}>
                    {p}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-xl" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <CommodityForm 
        isOpen={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        editing={editing} 
        onSaveSuccess={fetchData} 
      />

      <CommodityDetail 
        detailTarget={detailTarget} 
        onClose={() => setDetailTarget(null)} 
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => { if (!isSubmitting) setDeleteTarget(null); }}>
        <AlertDialogContent className="sm:max-w-[460px] rounded-[28px] border border-border/80 shadow-2xl p-6 sm:p-7 bg-card gap-0 overflow-hidden">
          <AlertDialogHeader className="flex flex-row items-start gap-4 pb-5 mb-5 border-b border-border/60 space-y-0 text-left">
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0 shadow-xs">
              <Trash2 size={22} />
            </div>
            <div className="flex flex-col gap-1 pr-6">
              <AlertDialogTitle className="text-xl font-black tracking-tight text-foreground leading-snug">
                {t('Hapus Komoditi?')}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
                {t('Apakah Anda yakin ingin menghapus')} <strong>{deleteTarget?.nama_komoditi}</strong>? {t('Data lingkungan, hama, dan sensor terkait juga akan dihapus.')}
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-2 flex flex-row items-center justify-end gap-3 space-x-0">
            <AlertDialogCancel className="h-11 px-6 rounded-2xl border-border/80 font-extrabold text-xs bg-muted/30 hover:bg-muted transition-all m-0" disabled={isSubmitting}>
              {t('Batal')}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                if (!isSubmitting) handleDelete();
              }}
              disabled={isSubmitting}
              className="h-11 px-7 rounded-2xl font-black text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 transition-all cursor-pointer m-0"
            >
              {isSubmitting ? t('Menghapus...') : t('Ya, Hapus')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

export default CommodityView;
