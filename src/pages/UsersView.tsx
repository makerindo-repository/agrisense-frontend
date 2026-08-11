import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Search, Plus, Save, Edit, Trash2, Download, CheckCircle2, 
  ShieldCheck, UserCheck, Shield, KeyRound, Lock, UserCog, UserPlus, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTimeShort } from '@/utils/formatters';
import { User, UserRole } from '../lib/mockData';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { toast } from 'sonner';

export default function UsersView({ users, setUsers }: { users: User[], setUsers: React.Dispatch<React.SetStateAction<User[]>> }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User> & { password?: string }>({
    name: "",
    email: "",
    role: "viewer",
    status: "active",
    password: ""
  });

  // Fetch users from API if needed
  useEffect(() => {
    if (users.length === 0) {
      api.get('/users')
        .then(res => {
          const fetchedData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
          if (Array.isArray(fetchedData) && fetchedData.length > 0) {
            const mappedUsers: User[] = fetchedData.map((u: any) => ({
              id: u.id?.startsWith?.('USR-') ? u.id : `USR-${u.real_id || u.id}`,
              name: u.name,
              email: u.email,
              role: (u.role || 'viewer') as UserRole,
              status: u.status || 'active',
              lastLogin: u.created_at || u.updated_at || new Date().toISOString(),
              real_id: u.real_id || u.id
            }));
            setUsers(mappedUsers);
          }
        })
        .catch(err => console.error("UsersView fetch error", err));
    }
  }, [users.length, setUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error(t('Nama, email, dan password wajib diisi!'));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.post('/users', {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
      });

      const data = res.data;
      const userToAdd: User = {
        id: `USR-${data.user?.id || Date.now()}`,
        name: data.user?.name || newUser.name!,
        email: data.user?.email || newUser.email!,
        role: (data.user?.role || newUser.role) as UserRole,
        status: 'active',
        lastLogin: data.user?.updated_at || new Date().toISOString(),
        real_id: data.user?.id
      };

      setUsers([...users, userToAdd]);
      setIsAddUserOpen(false);
      setNewUser({ name: "", email: "", role: "viewer", status: "active", password: "" });
      toast.success(t('Pengguna baru berhasil ditambahkan!'));
    } catch (err: any) {
      console.error("Failed to add user", err);
      toast.error(err.response?.data?.message || t('Gagal menambahkan pengguna'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    const dbId = (editingUser as any).real_id;
    if (!dbId) {
      toast.error(t('Pengguna ini tidak memiliki ID database.'));
      return;
    }
    setIsSubmitting(true);
    try {
      await api.put(`/users/${dbId}`, {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        status: editingUser.status,
      });
      setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
      setIsEditUserOpen(false);
      setEditingUser(null);
      toast.success(t('Data pengguna berhasil diperbarui!'));
    } catch (err: any) {
      console.error("Failed to edit user", err);
      toast.error(err.response?.data?.message || t('Gagal memperbarui pengguna'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    const dbId = (userToDelete as any).real_id;
    setIsSubmitting(true);
    
    try {
      if (dbId) {
        await api.delete(`/users/${dbId}`);
      }
      setUsers(users.filter(u => u.id !== userToDelete.id));
      toast.success(t('Pengguna berhasil dihapus'));
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (err: any) {
      console.error("Failed to delete user", err);
      toast.error(err.response?.data?.message || t('Gagal menghapus pengguna'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportToExcel = () => {
    const data = filteredUsers.map(u => ({
      ID: u.id,
      Nama: u.name,
      Email: u.email,
      Role: u.role,
      Status: u.status,
      'Login Terakhir': formatDateTimeShort(u.lastLogin)
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    XLSX.writeFile(workbook, "AgriSense_Users.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Daftar Pengguna AgriSense", 14, 15);
    
    const tableData = filteredUsers.map(u => [
      u.id,
      u.name,
      u.email,
      u.role,
      u.status,
      formatDateTimeShort(u.lastLogin)
    ]);

    autoTable(doc, {
      head: [['ID', 'Nama', 'Email', 'Role', 'Status', 'Login Terakhir']],
      body: tableData,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save("AgriSense_Users.pdf");
  };

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto pb-24 select-none block">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-xs shrink-0">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              {t('Manajemen Pengguna')}
            </h1>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {t('Kelola akses, daftar pengguna, peran sistem, dan otentikasi akun')}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="h-11 w-full sm:w-auto px-4 rounded-2xl border border-border/80 bg-card font-extrabold text-xs shadow-sm cursor-pointer gap-2 flex items-center justify-center hover:bg-muted/50 transition-colors">
                <Download size={16} />
                {t('Ekspor Data')}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl border-border shadow-2xl p-1.5">
              <DropdownMenuItem onClick={exportToExcel} className="font-extrabold text-xs rounded-xl cursor-pointer py-2.5">
                {t('Export ke Excel (.xlsx)')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF} className="font-extrabold text-xs rounded-xl cursor-pointer py-2.5">
                {t('Export ke PDF (.pdf)')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* DIALOG: TAMBAH PENGGUNA BARU */}
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger>
              <div className="h-11 w-full sm:w-auto px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 cursor-pointer gap-2 flex items-center justify-center transition-all">
                <Plus size={16} />
                {t('Tambah Pengguna')}
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] rounded-[28px] border border-border/80 shadow-2xl p-6 sm:p-7 bg-card gap-0 overflow-hidden">
              <DialogHeader className="flex flex-row items-start gap-4 pb-5 mb-5 border-b border-border/60 space-y-0 text-left">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 shadow-xs">
                  <UserPlus size={22} />
                </div>
                <div className="flex flex-col gap-1 pr-6">
                  <DialogTitle className="text-xl font-black tracking-tight text-foreground leading-snug">
                    {t('Tambah Pengguna Baru')}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
                    {t('Masukkan detail pengguna baru untuk memberikan akses ke sistem.')}
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                    {t('Nama Lengkap')}
                  </Label>
                  <Input 
                    id="name" 
                    placeholder={t('Nama lengkap')} 
                    className="w-full rounded-2xl h-11 px-4 border-border/80 bg-muted/20 font-semibold text-xs focus:bg-background focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-xs"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                    {t('Alamat Email')}
                  </Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="pengguna@agrisense.id" 
                    className="w-full rounded-2xl h-11 px-4 border-border/80 bg-muted/20 font-semibold text-xs focus:bg-background focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-xs"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                    {t('Kata Sandi')} <span className="text-rose-500">*</span>
                  </Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder={t('Minimal 8 karakter')} 
                    className="w-full rounded-2xl h-11 px-4 border-border/80 bg-muted/20 font-semibold text-xs focus:bg-background focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-xs"
                    value={newUser.password || ''}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                    {t('Peran Akses')}
                  </Label>
                  <select
                    id="role"
                    value={newUser.role || 'viewer'}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value as UserRole})}
                    className="w-full rounded-2xl h-11 px-4 border border-border/80 bg-muted/20 font-semibold text-xs text-foreground focus:bg-background focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all shadow-xs cursor-pointer"
                  >
                    <option value="admin" className="bg-background text-foreground font-bold py-2">Administrator ({t('Akses Penuh')})</option>
                    <option value="operator" className="bg-background text-foreground font-bold py-2">Operator ({t('Manajemen Data')})</option>
                    <option value="viewer" className="bg-background text-foreground font-bold py-2">Viewer ({t('Hanya Lihat')})</option>
                  </select>
                </div>
              </div>

              <DialogFooter className="-mx-6 -mb-6 sm:-mx-7 sm:-mb-7 mt-6 px-6 py-4 sm:px-8 sm:py-5 border-t border-border/60 bg-muted/30 rounded-b-[28px] flex flex-row items-center justify-end gap-3 space-x-0">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setIsAddUserOpen(false)} 
                  className="h-11 px-6 rounded-2xl border-border/80 font-extrabold text-xs bg-card hover:bg-muted transition-all cursor-pointer m-0"
                >
                  {t('Batal')}
                </Button>
                <Button 
                  type="button"
                  onClick={handleAddUser} 
                  disabled={isSubmitting} 
                  className="h-11 px-7 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 transition-all cursor-pointer m-0"
                >
                  {isSubmitting ? t('Menyimpan...') : t('Simpan Pengguna')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
        <CardHeader className="bg-muted/30 border-b border-border/60 p-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input 
                placeholder={t('Cari nama atau email...')} 
                className="pl-10 h-11 bg-card border-border/80 font-bold text-xs rounded-2xl shadow-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-black text-xs px-3 py-1 rounded-full">
                {filteredUsers.length} {t('Total Pengguna')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border/60">
              <TableRow>
                <TableHead className="pl-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('Pengguna')}</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('Peran Akses')}</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('Dibuat Pada')}</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('Status Akun')}</TableHead>
                <TableHead className="text-right pr-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">{t('Aksi')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/50">
              {filteredUsers.map((u) => (
                <TableRow key={u.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 border shadow-xs",
                        u.role === 'admin' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : 
                        u.role === 'operator' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" : 
                        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                      )}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-foreground">{u.name}</span>
                        <span className="text-[11px] font-semibold text-muted-foreground">{u.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge className={cn(
                      "rounded-xl font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-0.5 border-none",
                      u.role === 'admin' ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : 
                      u.role === 'operator' ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : 
                      "bg-slate-500/15 text-slate-700 dark:text-slate-400"
                    )}>
                      {u.role === 'admin' ? 'Administrator' : u.role === 'operator' ? 'Operator' : 'Viewer'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-semibold py-4">
                    {formatDateTimeShort(u.lastLogin)}
                  </TableCell>
                  <TableCell className="py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 shrink-0 whitespace-nowrap min-w-[90px]">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        u.status === 'active' ? "bg-emerald-500" : "bg-rose-500"
                      )} />
                      <span className={cn("text-xs font-extrabold whitespace-nowrap shrink-0", u.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                        {u.status === 'active' ? t('Aktif') : t('Nonaktif')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        size="icon" 
                        variant="outline"
                        className="h-8.5 w-8.5 rounded-xl border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shadow-xs transition-all" 
                        onClick={() => {
                          setEditingUser({...u});
                          setIsEditUserOpen(true);
                        }}
                        title={t('Edit')}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline"
                        className="h-8.5 w-8.5 rounded-xl border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 cursor-pointer shadow-xs transition-all" 
                        onClick={() => {
                          setUserToDelete(u);
                          setIsDeleteDialogOpen(true);
                        }}
                        title={t('Hapus')}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role Access Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
          <CardHeader className="bg-muted/30 border-b border-border/60 p-5 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <ShieldCheck size={18} />
              </div>
              <CardTitle className="text-sm font-black text-foreground">Administrator</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 text-xs font-semibold text-muted-foreground leading-relaxed">
            {t('Akses penuh ke seluruh sistem, termasuk manajemen pengguna, pengaturan perangkat, dan konfigurasi sistem.')}
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
          <CardHeader className="bg-muted/30 border-b border-border/60 p-5 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <UserCog size={18} />
              </div>
              <CardTitle className="text-sm font-black text-foreground">Operator</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 text-xs font-semibold text-muted-foreground leading-relaxed">
            {t('Akses ke dashboard, analitik, dan laporan. Dapat mengelola perangkat tetapi tidak dapat mengelola pengguna.')}
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden w-full">
          <CardHeader className="bg-muted/30 border-b border-border/60 p-5 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 shrink-0">
                <UserCheck size={18} />
              </div>
              <CardTitle className="text-sm font-black text-foreground">Viewer</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 text-xs font-semibold text-muted-foreground leading-relaxed">
            {t('Akses terbatas untuk memantau data sensor dan status perangkat secara real-time. Tidak dapat mengubah konfigurasi.')}
          </CardContent>
        </Card>
      </div>

      {/* DIALOG: EDIT USER */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-[28px] border border-border/80 shadow-2xl p-6 sm:p-7 bg-card gap-0 overflow-hidden">
          <DialogHeader className="flex flex-row items-start gap-4 pb-5 mb-5 border-b border-border/60 space-y-0 text-left">
            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0 shadow-xs">
              <UserCog size={22} />
            </div>
            <div className="flex flex-col gap-1 pr-6">
              <DialogTitle className="text-xl font-black tracking-tight text-foreground leading-snug">
                {t('Edit Pengguna')}
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
                Ubah detail pengguna <strong>{editingUser?.name}</strong>.
              </DialogDescription>
            </div>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                  {t('Nama Lengkap')}
                </Label>
                <Input 
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full rounded-2xl h-11 px-4 border-border/80 bg-muted/20 font-semibold text-xs focus:bg-background focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all shadow-xs"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                  {t('Alamat Email')}
                </Label>
                <Input 
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="w-full rounded-2xl h-11 px-4 border-border/80 bg-muted/20 font-semibold text-xs focus:bg-background focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all shadow-xs"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                  {t('Peran Akses')}
                </Label>
                <select
                  value={editingUser.role || 'viewer'}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                  className="w-full rounded-2xl h-11 px-4 border border-border/80 bg-muted/20 font-semibold text-xs text-foreground focus:bg-background focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all shadow-xs cursor-pointer"
                >
                  <option value="admin" className="bg-background text-foreground font-bold py-2">Administrator ({t('Akses Penuh')})</option>
                  <option value="operator" className="bg-background text-foreground font-bold py-2">Operator ({t('Manajemen Data')})</option>
                  <option value="viewer" className="bg-background text-foreground font-bold py-2">Viewer ({t('Hanya Lihat')})</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                  {t('Status Akun')}
                </Label>
                <select
                  value={editingUser.status || 'active'}
                  onChange={(e) => setEditingUser({...editingUser, status: e.target.value as 'active' | 'inactive'})}
                  className="w-full rounded-2xl h-11 px-4 border border-border/80 bg-muted/20 font-semibold text-xs text-foreground focus:bg-background focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all shadow-xs cursor-pointer"
                >
                  <option value="active" className="bg-background text-foreground font-bold py-2">🟢 {t('Aktif')} — {t('Dapat login ke sistem')}</option>
                  <option value="inactive" className="bg-background text-foreground font-bold py-2">🔴 {t('Nonaktif')} — {t('Tidak dapat login')}</option>
                </select>
              </div>
            </div>
          )}

          <DialogFooter className="-mx-6 -mb-6 sm:-mx-7 sm:-mb-7 mt-6 px-6 py-4 sm:px-8 sm:py-5 border-t border-border/60 bg-muted/30 rounded-b-[28px] flex flex-row items-center justify-end gap-3 space-x-0">
            <Button 
              type="button"
              variant="outline" 
              onClick={() => setIsEditUserOpen(false)} 
              className="h-11 px-6 rounded-2xl border-border/80 font-extrabold text-xs bg-card hover:bg-muted transition-all cursor-pointer m-0"
            >
              {t('Batal')}
            </Button>
            <Button 
              type="button"
              onClick={handleEditUser} 
              disabled={isSubmitting} 
              className="h-11 px-7 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/25 transition-all cursor-pointer m-0"
            >
              {isSubmitting ? t('Menyimpan...') : t('Simpan Perubahan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: DELETE USER */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!isSubmitting) setIsDeleteDialogOpen(open); }}>
        <AlertDialogContent className="sm:max-w-[460px] rounded-[28px] border border-border/80 shadow-2xl p-6 sm:p-7 bg-card gap-0 overflow-hidden">
          <AlertDialogHeader className="flex flex-row items-start gap-4 pb-5 mb-5 border-b border-border/60 space-y-0 text-left">
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0 shadow-xs">
              <Trash2 size={22} />
            </div>
            <div className="flex flex-col gap-1 pr-6">
              <AlertDialogTitle className="text-xl font-black tracking-tight text-foreground leading-snug">
                {t('Hapus Pengguna?')}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
                {t('Tindakan ini tidak dapat dibatalkan. Ini akan menghapus akun')} <strong>{userToDelete?.name}</strong> {t('secara permanen dari sistem.')}
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-2 flex flex-row items-center justify-end gap-3 space-x-0">
            <AlertDialogCancel className="h-11 px-6 rounded-2xl border-border/80 font-extrabold text-xs bg-muted/30 hover:bg-muted transition-all m-0">
              {t('Batal')}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                if (!isSubmitting) handleDeleteUser();
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
}
