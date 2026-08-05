import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, Radio, Database, CloudSun, Map as MapIcon, BarChart3, 
  FileText, Settings, Users, Bell, Search, Menu, X, Droplets, Thermometer, 
  Wind, Battery, Signal, AlertTriangle, Leaf, LogIn, LogOut, Calendar as CalendarIcon, 
  FlaskConical, Zap, Activity, Filter, Plus, Save, MoreVertical, Edit, Trash2, 
  Download, CheckCircle2, Eye, EyeOff, Trees, Layers, Sprout, MapPin, SearchIcon, Share2, Map as MapIconS
} from 'lucide-react';
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
import { formatDateTimeShort, formatDateTimeLong } from '@/utils/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter, ZAxis, Legend } from 'recharts';
import { IoTNode, User, UserRole } from '../lib/mockData';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Map related overrides
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Tooltip as LeafletTooltip } from 'react-leaflet';
import L from 'leaflet';
import LeafletDrawMap, { PolygonDrawResult } from '../components/LeafletDrawMap';

// App specific imports
import api from '../lib/api';
import { toast } from 'sonner';

export default function UsersView({ users, setUsers }: { users: User[], setUsers: React.Dispatch<React.SetStateAction<User[]>> }) {
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

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('Nama, email, dan password wajib diisi!');
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
      toast.success('Pengguna baru berhasil ditambahkan!');
    } catch (err: any) {
      console.error("Failed to add user", err);
      toast.error(err.response?.data?.message || 'Gagal menambahkan pengguna');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    const dbId = (editingUser as any).real_id;
    if (!dbId) {
      toast.error('Pengguna ini tidak memiliki ID database.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.put(`/users/${dbId}`, {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
      });
      setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
      setIsEditUserOpen(false);
      setEditingUser(null);
      toast.success('Data pengguna berhasil diperbarui!');
    } catch (err: any) {
      console.error("Failed to edit user", err);
      toast.error(err.response?.data?.message || 'Gagal memperbarui pengguna');
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
      toast.success('Pengguna berhasil dihapus');
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (err: any) {
      console.error("Failed to delete user", err);
      toast.error(err.response?.data?.message || 'Gagal menghapus pengguna');
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
      headStyles: { fillColor: [16, 185, 129] } // AgriSense Emerald
    });

    doc.save("AgriSense_Users.pdf");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manajemen Pengguna</h1>
          <p className="text-muted-foreground">Kelola akses dan peran pengguna dalam sistem AgriSense</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" className="h-11 rounded-md font-bold gap-2">
                <Download size={18} />
                Ekspor Data
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-md">
              <DropdownMenuItem onClick={exportToExcel} className="font-medium cursor-pointer">
                Export ke Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF} className="font-medium cursor-pointer">
                Export ke PDF (.pdf)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger>
              <Button className="h-11 rounded-md font-bold gap-2 shadow-sm shadow-primary/20">
                <Plus size={18} />
                Tambah Pengguna
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Tambah Pengguna Baru</DialogTitle>
                <DialogDescription>
                  Masukkan detail pengguna baru untuk memberikan akses ke sistem.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="font-bold text-xs uppercase tracking-wider">Nama Lengkap</Label>
                  <Input 
                    id="name" 
                    placeholder="Nama lengkap" 
                    className="rounded-xl h-11"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email" className="font-bold text-xs uppercase tracking-wider">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="pengguna@agrisense.id" 
                    className="rounded-xl h-11"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password" className="font-bold text-xs uppercase tracking-wider">Password <span className="text-destructive">*</span></Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="Minimal 8 karakter" 
                    className="rounded-xl h-11"
                    value={newUser.password || ''}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role" className="font-bold text-xs uppercase tracking-wider">Peran (Role)</Label>
                  <Select 
                    value={newUser.role} 
                    onValueChange={(value) => setNewUser({...newUser, role: value as UserRole})}
                  >
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Pilih role" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="operator">Operator</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddUserOpen(false)} className="rounded-xl h-11 font-bold">Batal</Button>
                <Button onClick={handleAddUser} disabled={isSubmitting} className="rounded-xl h-11 font-bold">
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pengguna'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-none shadow-sm shadow-black/5 overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/20 py-4 px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input 
                placeholder="Cari nama atau email..." 
                className="pl-10 h-10 bg-white border-none shadow-sm rounded-md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white font-bold">{filteredUsers.length} Total Pengguna</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="pl-8 font-black uppercase text-[10px] tracking-widest">Pengguna</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Role</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Status</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Login Terakhir</TableHead>
                <TableHead className="text-right pr-8 font-black uppercase text-[10px] tracking-widest">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.id} className="group hover:bg-muted/20 transition-colors">
                  <TableCell className="pl-8">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                            u.role === 'admin' ? "bg-primary/20 text-primary" : 
                            u.role === 'operator' ? "bg-amber-100 text-amber-600" : 
                            "bg-slate-100 text-slate-600"
                          )}>
                            {u.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{u.name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{u.role}</span>
                          </div>
                        </div>
                  </TableCell>
                  <TableCell>
                      <Badge variant="secondary" className={cn(
                        "rounded-lg font-bold text-[10px] uppercase tracking-wider py-0.5",
                        u.role === 'admin' ? "bg-primary/10 text-primary border-primary/20" : 
                        u.role === 'operator' ? "bg-amber-100 text-amber-600 border-amber-200" : 
                        "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {u.role}
                      </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        u.status === 'active' ? "bg-emerald-500" : "bg-slate-300"
                      )} />
                      <span className="text-xs font-medium capitalize">{u.status === 'active' ? 'Aktif' : u.status === 'inactive' ? 'Nonaktif' : u.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">
                    {formatDateTimeLong(u.lastLogin)}
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        size="icon" 
                        className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm" 
                        onClick={() => {
                          setEditingUser({...u});
                          setIsEditUserOpen(true);
                        }}
                      >
                        <Edit size={15}/>
                      </Button>
                      <Button 
                        size="icon" 
                        className="h-8 w-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm" 
                        onClick={() => {
                          setUserToDelete(u);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 size={15}/>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role Access Matrix Hint */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm shadow-black/5 bg-primary/5 border border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              Admin
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground leading-relaxed">
            Akses penuh ke seluruh sistem, termasuk manajemen pengguna, pengaturan perangkat, dan konfigurasi sistem.
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm shadow-black/5 bg-amber-50/50 border border-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700">
              Operator
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-amber-800/70 leading-relaxed">
            Akses ke dashboard, analitik, dan laporan. Dapat mengelola perangkat tetapi tidak dapat mengelola pengguna.
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm shadow-black/5 bg-slate-50 border border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
              Viewer
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-slate-800/70 leading-relaxed">
            Akses terbatas untuk memantau data sensor dan status perangkat secara real-time. Tidak dapat mengubah konfigurasi.
          </CardContent>
        </Card>
      </div>

      {/* ══ DIALOG: EDIT PENGGUNA ══ */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Pengguna</DialogTitle>
            <DialogDescription>
              Ubah detail pengguna <strong>{editingUser?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Nama Lengkap</Label>
                <Input 
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Email</Label>
                <Input 
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="grid gap-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Peran (Role)</Label>
                <Select 
                  value={editingUser.role} 
                  onValueChange={(value) => setEditingUser({...editingUser, role: value as UserRole})}
                >
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue />
                  </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="operator">Operator</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)} className="rounded-xl h-11 font-bold">Batal</Button>
            <Button onClick={handleEditUser} disabled={isSubmitting} className="rounded-xl h-11 font-bold">
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ══ DIALOG: KONFIRMASI HAPUS ══ */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!isSubmitting) setIsDeleteDialogOpen(open); }}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-2">
              <Trash2 size={24} />
            </div>
            <AlertDialogTitle className="text-xl font-bold">Hapus Pengguna?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tindakan ini tidak dapat dibatalkan. Ini akan menghapus akun <strong>{userToDelete?.name}</strong> secara permanen dari sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel className="rounded-xl h-11 font-bold flex-1 border-none bg-muted hover:bg-muted/80">Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                if (!isSubmitting) handleDeleteUser();
              }} 
              disabled={isSubmitting}
              className="rounded-xl h-11 font-bold flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
