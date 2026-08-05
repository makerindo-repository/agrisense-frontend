import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Save, X, Leaf, ChevronLeft, ChevronRight, Eye, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import api from '../lib/api';

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
  const [data, setData] = useState<Komoditi[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [isSearchingLatin, setIsSearchingLatin] = useState(false);

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Komoditi | null>(null);
  const [formTab, setFormTab] = useState('dasar');
  const [deleteTarget, setDeleteTarget] = useState<Komoditi | null>(null);
  const [detailTarget, setDetailTarget] = useState<Komoditi | null>(null);

  // Form state fields handled by CommodityForm

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/komoditi');
      setData(res.data);
    } catch {
      toast.error('Gagal memuat data komoditi');
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
    try {
      await api.delete(`/komoditi/${deleteTarget.id}`);
      toast.success('Komoditi berhasil dihapus');
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menghapus komoditi');
      setDeleteTarget(null);
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
    <div className="space-y-6 px-4 md:px-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manajemen Komoditi</h1>
          <p className="text-muted-foreground text-sm">Pengelolaan data komoditi pertanian dan karakteristik budidaya</p>
        </div>
        <div className="flex items-center gap-3">
          {userRole !== 'viewer' && (
            <Button className="h-10 px-5 rounded-md font-medium gap-2 shadow-sm text-sm" onClick={openAdd}>
              <Plus size={18} /> Tambah Komoditi
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-2.5 mb-2">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Cari komoditi..."
            className="pl-9 h-9 text-sm border-border/50 rounded-md bg-card shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterKategori} onValueChange={(v) => setFilterKategori(v || 'Semua')}>
          <SelectTrigger className="w-full md:w-48 h-9 text-sm rounded-md border-border/50 bg-card shadow-sm">
            <SelectValue placeholder="Jenis Tanaman" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Semua</SelectItem>
            {KATEGORI_OPTIONS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v || 'Semua')}>
          <SelectTrigger className="w-full md:w-36 h-9 text-sm rounded-md border-border/50 bg-card shadow-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Semua</SelectItem>
            <SelectItem value="Aktif">Aktif</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Nonaktif">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
        {(filterKategori || filterStatus || searchQuery) && (
          <Button variant="ghost" size="sm" className="text-sm h-9" onClick={() => { setSearchQuery(''); setFilterKategori(''); setFilterStatus(''); }}>
            Reset
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="pl-5 text-xs font-semibold">ID</TableHead>
                  <TableHead className="text-xs font-semibold">Jenis Tanaman</TableHead>
                  <TableHead className="text-xs font-semibold">Kategori</TableHead>
                  <TableHead className="text-xs font-semibold">Suhu Ideal</TableHead>
                  <TableHead className="text-xs font-semibold">pH Ideal</TableHead>
                  <TableHead className="text-xs font-semibold">Usia Panen</TableHead>
                  <TableHead className="text-xs font-semibold">Hama Utama</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                  {userRole !== 'viewer' && <TableHead className="text-xs font-semibold text-right pr-5">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">Memuat data...</TableCell></TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">Tidak ada data komoditi ditemukan</TableCell></TableRow>
                ) : paginated.map(k => {
                  const lg = k.lingkungan;
                  const hamas = (k.hama_penyakit || []).filter(h => h.jenis === 'Hama').map(h => h.nama).join(', ');
                  return (
                    <TableRow key={k.id} className="hover:bg-muted/20 transition-colors group">
                      <TableCell className="text-sm pl-5">{k.kode_komoditi}</TableCell>
                      <TableCell className="text-sm">
                        {k.nama_komoditi}
                      </TableCell>
                      <TableCell className="text-sm">{k.kategori_tanaman}</TableCell>
                      <TableCell className="text-sm">{lg ? formatRange(lg.suhu_min, lg.suhu_max, '°C') : '-'}</TableCell>
                      <TableCell className="text-sm">{lg ? formatRange(lg.ph_min, lg.ph_max) : '-'}</TableCell>
                      <TableCell className="text-sm">{k.fase_tanam ? formatRange(k.fase_tanam.usia_tanam_min, k.fase_tanam.usia_tanam_max, k.fase_tanam.satuan_usia) : '-'}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate" title={hamas}>{hamas || '-'}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-block min-w-[75px] text-xs px-3 py-1 rounded-full font-medium text-center ${
                          k.status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' :
                          k.status === 'Draft' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>{k.status}</span>
                      </TableCell>
                      {userRole !== 'viewer' && (
                        <TableCell className="text-right pr-5">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm" onClick={() => setDetailTarget(k)} title="Lihat Detail">
                              <Eye size={15} />
                            </Button>
                            <Button size="icon" className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm" onClick={() => openEdit(k)} title="Edit">
                              <Edit size={15} />
                            </Button>
                            {!k.is_system && (
                              <Button size="icon" className="h-8 w-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm" onClick={() => setDeleteTarget(k)} title="Hapus">
                                <Trash2 size={15} />
                              </Button>
                            )}
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
          <div className="flex items-center justify-between px-5 py-3 border-t text-sm text-muted-foreground">
            <span>Menampilkan {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE, filtered.length)} dari {filtered.length} data</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={16} />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <Button key={p} variant={page === p ? "default" : "outline"} size="sm" className="h-8 w-8 p-0 text-xs" onClick={() => setPage(p)}>
                    {p}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
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
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold">Hapus Komoditi</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.nama_komoditi}</strong>? Data lingkungan, hama, dan sensor terkait juga akan dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-md">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md">
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

export default CommodityView;
