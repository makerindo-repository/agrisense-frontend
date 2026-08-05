import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Upload } from 'lucide-react';
import api from '../lib/api';
import { getStoredUser } from '../lib/storage';

interface AboutCard {
  id: number;
  type: 'team' | 'feature';
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  link: string | null;
  sort_order: number;
  is_active: boolean;
}

interface CardFormData {
  type: 'team' | 'feature';
  title: string;
  subtitle: string;
  description: string;
  image_url: string;
  link: string;
  sort_order: number;
  is_active: boolean;
}

const EMPTY_FORM: CardFormData = {
  type: 'team',
  title: '',
  subtitle: '',
  description: '',
  image_url: '',
  link: '',
  sort_order: 0,
  is_active: true,
};

const AboutView = React.memo(() => {
  const [cards, setCards] = useState<AboutCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCard, setEditingCard] = useState<AboutCard | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'team' | 'feature'>('team');
  const [form, setForm] = useState<CardFormData>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const user = getStoredUser();
  const canEdit = user?.role === 'admin' || user?.role === 'operator';

  const fetchCards = useCallback(async () => {
    try {
      const endpoint = canEdit ? '/about-cards/admin' : '/about-cards';
      const res = await api.get(endpoint);
      setCards(res.data);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [canEdit]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const featureCards = cards.filter(c => c.type === 'feature' && (canEdit || c.is_active));
  const teamCards = cards.filter(c => c.type === 'team' && (canEdit || c.is_active));

  const openAddForm = (type: 'team' | 'feature') => {
    setEditingCard(null);
    setFormType(type);
    setImageFile(null);
    setForm({ ...EMPTY_FORM, type, sort_order: cards.filter(c => c.type === type).length + 1 });
    setShowForm(true);
  };

  const openEditForm = (card: AboutCard) => {
    setEditingCard(card);
    setFormType(card.type);
    setImageFile(null);
    setForm({
      type: card.type,
      title: card.title,
      subtitle: card.subtitle || '',
      description: card.description || '',
      image_url: card.image_url || '',
      link: card.link || '',
      sort_order: card.sort_order,
      is_active: card.is_active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('type', form.type);
      formData.append('title', form.title);
      formData.append('subtitle', form.subtitle);
      formData.append('description', form.description);
      formData.append('sort_order', form.sort_order.toString());
      formData.append('is_active', form.is_active ? '1' : '0');
      if (form.link) formData.append('link', form.link);
      if (imageFile) formData.append('image_upload', imageFile);

      if (editingCard) {
        formData.append('_method', 'PUT');
        await api.post(`/about-cards/${editingCard.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.post('/about-cards', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      setShowForm(false);
      setEditingCard(null);
      setImageFile(null);
      fetchCards();
    } catch (err) {
      console.error('Gagal menyimpan:', err);
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async (id: number) => {
    try {
      await api.delete(`/about-cards/${id}`);
      fetchCards();
    } catch (err) {
      console.error('Gagal menghapus:', err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const toggleActive = async (card: AboutCard) => {
    try {
      await api.put(`/about-cards/${card.id}`, { is_active: !card.is_active });
      fetchCards();
    } catch (err) {
      console.error('Gagal toggle:', err);
    }
  };

  return (
    <div className="w-full space-y-12 animate-in fade-in duration-500 max-w-5xl mx-auto">

      {/* App Info Section */}
      <section className="flex flex-col items-center justify-center text-center space-y-6 pt-10 pb-6 border-b border-border">
        <div className="w-20 h-20 bg-primary/10 flex items-center justify-center rounded-2xl mb-2">
          <img src="/logo_utama.png" alt="AgriSense Logo" className="w-14 h-14 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Tentang AgriSense</h1>
          <p className="text-muted-foreground max-w-3xl text-sm md:text-base leading-relaxed mx-auto">
            AgriSense merupakan sistem pemantauan analitik cerdas yang memadukan <em>Internet of Things</em> (IoT) dan algoritma Kecerdasan Buatan (AI). Website ini diciptakan khusus untuk merekam, memetakan, serta memprediksi jejak emisi karbon lingkungan secara langsung. Didukung oleh integrasi data klimatologi BMKG dan analisis kondisi ekosistem, sistem ini menyajikan wawasan terpadu demi mengakselerasi langkah nyata mitigasi perubahan iklim global.
          </p>
        </div>

        {/* Feature Cards (Hardcoded) */}
        <div className="w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-card rounded-xl border border-border shadow-sm text-left">
              <h3 className="font-bold text-lg mb-2">Pemantauan Presisi</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Pengumpulan data lingkungan secara real-time memastikan Anda selalu mengetahui kadar emisi karbon kapan saja dan di mana saja.</p>
            </div>
            <div className="p-6 bg-card rounded-xl border border-border shadow-sm text-left">
              <h3 className="font-bold text-lg mb-2">Analisis Kecerdasan Buatan</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">AI kami mempelajari pola klimatologi untuk memberikan prediksi anomali gas karbon dan peringatan dini cuaca ekstrem.</p>
            </div>
            <div className="p-6 bg-card rounded-xl border border-border shadow-sm text-left">
              <h3 className="font-bold text-lg mb-2">Skalabilitas Tinggi</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Dari area kecil hingga skala kawasan luas, AgriSense dirancang untuk menyesuaikan kebutuhan analitik lingkungan Anda.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Grid Section */}
      <section className="space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">Tim Pengembang</h2>
          <p className="text-muted-foreground text-sm mt-2">Pilar utama di balik riset dan pengembangan AgriSense</p>
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <button onClick={() => openAddForm('team')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              Tambah Anggota
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : teamCards.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">Belum ada data tim pengembang.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamCards.map((member) => (
              <Card key={member.id} className={`overflow-hidden bg-card border-border relative group ${!member.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="p-0 flex flex-row sm:flex-col">
                  <div className="w-1/3 sm:w-full sm:aspect-video bg-muted overflow-hidden relative shrink-0">
                    <img
                      src={member.image_url || '/user.png'}
                      alt={member.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = '/user.png'; }}
                    />
                  </div>
                  <div className="p-4 sm:p-6 space-y-2 flex-1 flex flex-col justify-center">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold tracking-tight">{member.title}</h3>
                      {member.subtitle && (
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider">{member.subtitle}</p>
                      )}
                    </div>
                    {member.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed pt-2">{member.description}</p>
                    )}
                    {member.link && (
                      <p className="text-xs font-medium text-muted-foreground mt-2 inline-flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
                        {member.link}
                      </p>
                    )}
                  </div>
                </CardContent>
                {canEdit && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggleActive(member)} className={`p-1.5 rounded-md text-xs ${member.is_active ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`} title={member.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                      {member.is_active ? '👁' : '👁‍🗨'}
                    </button>
                    <button onClick={() => openEditForm(member)} className="p-1.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs" title="Edit">✏️</button>
                    <button onClick={() => setDeleteConfirmId(member.id)} className="p-1.5 rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs" title="Hapus">🗑</button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Partner Logos */}
      <section className="pt-10 pb-6 mt-10">
        <div className="flex flex-col items-center space-y-6">
          <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Didukung Oleh</p>
          <div className="flex flex-wrap justify-center items-center gap-6 opacity-70 grayscale">
            <img src="/logo-unikom.png" alt="UNIKOM" className="h-10 w-auto object-contain" width={40} height={40} />
            <img src="/Logo_LPDP.png" alt="LPDP" className="h-10 w-auto object-contain" width={80} height={40} />
            <img src="/Logo_Waseda.png" alt="Waseda" className="h-10 w-auto object-contain" width={127} height={40} />
            <img src="/Logo_CMU.png" alt="CMU" className="h-10 w-auto object-contain" width={40} height={40} />
            <img src="/Logo_UTokyo.png" alt="UTokyo" className="h-11 w-auto object-contain" width={44} height={44} />
            <img src="/tutwuri-handayan.png" alt="Kemdikbud" className="h-10 w-auto object-contain" width={38} height={40} />
          </div>
        </div>
      </section>

      {/* CRUD Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">
                  {editingCard ? 'Edit' : 'Tambah'} {formType === 'team' ? 'Anggota Tim' : 'Kartu Fitur'}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-1 rounded-md hover:bg-muted text-muted-foreground">✕</button>
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                {/* Photo Upload */}
                <div className="w-full md:w-48 shrink-0 flex flex-col gap-2">
                  <Label className="text-xs font-medium">Foto Profil</Label>
                  <div className="border-2 border-dashed rounded-lg flex items-center justify-center h-48 bg-muted/20 relative overflow-hidden group">
                    {imageFile ? (
                      <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-full object-cover" />
                    ) : form.image_url ? (
                      <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-muted-foreground flex flex-col items-center">
                        <Upload className="w-6 h-6 mb-1 opacity-50" />
                        <span className="text-xs">Pilih Foto</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          setImageFile(e.target.files[0]);
                        }
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/50 p-1 text-[10px] text-white text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      Klik untuk ubah foto
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Nama Anggota *</Label>
                    <Input
                      type="text"
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      className="h-9 text-sm rounded-md"
                      placeholder="Nama lengkap"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Jabatan/Role</Label>
                    <Input
                      type="text"
                      value={form.subtitle}
                      onChange={e => setForm({ ...form, subtitle: e.target.value })}
                      className="h-9 text-sm rounded-md"
                      placeholder="Jabatan / posisi"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Deskripsi</Label>
                    <Textarea
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      className="text-sm rounded-md min-h-[60px]"
                      placeholder="Deskripsi singkat..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Instansi</Label>
                    <Input
                      type="text"
                      value={form.link}
                      onChange={e => setForm({ ...form, link: e.target.value })}
                      className="h-9 text-sm rounded-md"
                      placeholder="Institusi / afiliasi"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Urutan</Label>
                      <Input
                        type="number"
                        value={form.sort_order}
                        onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                        className="h-9 text-sm rounded-md"
                        min={0}
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={e => setForm({ ...form, is_active: e.target.checked })}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <span className="text-sm font-medium">Aktif Ditampilkan</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">Batal</button>
                <button onClick={handleSave} disabled={saving || !form.title.trim()} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {saving ? 'Menyimpan...' : (editingCard ? 'Simpan' : 'Tambah')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Hapus Anggota Tim?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Tindakan ini tidak dapat dibatalkan. Anggota tim ini akan dihapus secara permanen dari daftar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-border bg-muted/20 font-bold">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId !== null) executeDelete(deleteConfirmId);
              }}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold px-8 shadow-lg shadow-destructive/20"
            >
              Hapus Selamanya
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

AboutView.displayName = 'AboutView';

export default AboutView;
