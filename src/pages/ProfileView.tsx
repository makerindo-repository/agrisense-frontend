import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  Save, Camera, User, Shield, Lock, Eye, EyeOff, 
  CheckCircle2, AlertCircle, Clock, Key, Globe, Sparkles, Activity, Laptop 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import api from '../lib/api';

interface ProfileViewProps {
  user: any;
  userRole: string;
  onUpdateUser: (updatedUser: any) => void;
  onNavigateBack: () => void;
}

const getFullUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}${path}`;
};

export default function ProfileView({ user, userRole, onUpdateUser }: ProfileViewProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState("info");
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(getFullUrl(user?.profile_photo || user?.photoURL) || null);
  
  // Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Language & Activity Logs
  const [selectedLang, setSelectedLang] = useState(user?.language || i18n.language || 'id');
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Fetch & Realtime Poll Activity Logs (5 Log Terbaru)
  useEffect(() => {
    let isMounted = true;
    const fetchLogs = () => {
      api.get('/logs')
        .then(res => {
          if (isMounted && Array.isArray(res.data)) {
            setActivityLogs(res.data.slice(0, 5));
          }
        })
        .catch(err => console.error('Gagal mengambil log aktivitas:', err))
        .finally(() => {
          if (isMounted) setIsLoadingLogs(false);
        });
    };

    setIsLoadingLogs(true);
    fetchLogs();

    // Polling realtime setiap 8 detik
    const interval = setInterval(fetchLogs, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Realtime Language Switch Handler
  const handleLanguageChange = (lang: string) => {
    setSelectedLang(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('agrisense_language', lang);
    toast.success(lang === 'id' ? 'Bahasa antarmuka diubah ke Bahasa Indonesia.' : 'Interface language switched to English.');
  };

  // Role Labels Dictionary
  const roleLabels: Record<string, string> = {
    admin: t('Administrator Sistem'),
    operator: t('Operator Perangkat'),
    viewer: t('Pemantau Data')
  };

  // Password Strength Calculator
  const passwordStrength = React.useMemo(() => {
    if (!newPassword) return { score: 0, label: '', color: 'bg-muted' };
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    if (score <= 1) return { score: 25, label: t('Lemah'), color: 'bg-rose-500' };
    if (score === 2 || score === 3) return { score: 65, label: t('Sedang'), color: 'bg-amber-500' };
    return { score: 100, label: t('Sangat Kuat'), color: 'bg-emerald-500' };
  }, [newPassword, t]);

  // Photo Upload Handler with Canvas Compression
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('Ukuran berkas foto maksimal 2MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setPhotoPreview(compressedBase64);
        setProfilePhoto(compressedBase64);
        toast.info(t('Foto berhasil dimuat. Klik Simpan Perubahan untuk memperbarui.'));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Save All Changes (Laravel Backend API Integration)
  const handleSaveAll = async () => {
    if (!name.trim()) {
      toast.error(t('Nama lengkap tidak boleh kosong.'));
      return;
    }

    const isPasswordAttempt = currentPassword || newPassword || confirmPassword;
    if (isPasswordAttempt) {
      if (!currentPassword) {
        toast.error(t('Masukkan kata sandi lama Anda terlebih dahulu.'));
        return;
      }
      if (newPassword.length < 8) {
        toast.error(t('Kata sandi baru minimal terdiri dari 8 karakter.'));
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error(t('Konfirmasi kata sandi baru tidak cocok dengan kata sandi baru.'));
        return;
      }
    }

    setIsSaving(true);
    let profileUpdated = false;
    let passwordUpdated = false;

    try {
      // 1. Update Profile
      const isProfileChanged = name.trim() !== user?.name || profilePhoto || selectedLang !== (user?.language || i18n.language);

      if (isProfileChanged) {
        const payload: any = {
          name: name.trim(),
          language: selectedLang
        };
        if (profilePhoto) payload.profile_photo = profilePhoto;

        const res = await api.put('/profile', payload);
        if (res.data?.status === 'success') {
          const updatedUser = { ...user, name: name.trim(), language: selectedLang };
          if (res.data.user?.profile_photo) {
            updatedUser.profile_photo = res.data.user.profile_photo;
            updatedUser.photoURL = res.data.user.profile_photo;
          }
          if (res.data.user?.language) {
            updatedUser.language = res.data.user.language;
          }
          localStorage.setItem('agrisense_user', JSON.stringify(updatedUser));
          localStorage.setItem('agrisense_language', selectedLang);
          onUpdateUser(updatedUser);
          setProfilePhoto(null);

          if (selectedLang !== i18n.language) {
            i18n.changeLanguage(selectedLang);
          }

          profileUpdated = true;
        }
      }

      // 2. Update Password
      if (isPasswordAttempt) {
        const res = await api.put('/profile/password', {
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirmation: confirmPassword,
        });
        if (res.data?.status === 'success') {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          passwordUpdated = true;
        }
      }

      if (profileUpdated && passwordUpdated) {
        toast.success(t('Profil dan kata sandi Anda berhasil diperbarui!'));
      } else if (profileUpdated) {
        toast.success(t('Informasi profil berhasil diperbarui!'));
      } else if (passwordUpdated) {
        toast.success(t('Kata sandi akun Anda berhasil diperbarui!'));
      } else if (!isPasswordAttempt && !isProfileChanged) {
        toast.info(t('Tidak ada perubahan data yang perlu disimpan.'));
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || t('Gagal menyimpan perubahan. Silakan periksa kembali data Anda.');
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 select-none">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{t('Profil Saya')}</h1>
          <p className="text-xs font-semibold text-muted-foreground">{t('Kelola biodata diri dan pengaturan keamanan akun Anda')}</p>
        </div>

        <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold text-xs">
          <Sparkles size={13} />
          {t('Akun Terverifikasi')}
        </Badge>
      </div>

      {/* Hero Banner Header */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-6 sm:p-7 shadow-xl relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-48 h-48 rounded-full bg-teal-400/20 blur-xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          {/* Avatar Ring Glassmorphism + Camera Uploader */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden ring-4 ring-white/30 shadow-2xl bg-white/10 backdrop-blur-md flex items-center justify-center p-1 relative">
              {photoPreview ? (
                <img 
                  src={photoPreview} 
                  alt="Avatar" 
                  className="w-full h-full rounded-2xl object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full rounded-2xl bg-emerald-900/40 text-white font-black text-3xl flex items-center justify-center">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
                </div>
              )}
            </div>

            <label className="absolute -bottom-1 -right-1 bg-white text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400 p-2 rounded-xl shadow-xl border border-emerald-500/20 cursor-pointer hover:scale-110 active:scale-95 transition-all">
              <Camera size={16} />
              <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </label>
          </div>

          {/* User Identity Info */}
          <div className="space-y-1 flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-2xl font-black tracking-tight drop-shadow-sm">{user?.name || t('Pengguna AgriSense')}</h2>
              <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md">
                {roleLabels[userRole] || userRole}
              </Badge>
            </div>
            <p className="text-emerald-100 text-xs font-medium opacity-90">{user?.email}</p>
          </div>
        </div>
      </motion.div>

      {/* Navigation Tab Bar */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col space-y-5">
        <TabsList className="inline-flex w-auto self-start h-11 p-1 bg-muted/60 rounded-2xl border border-border/60 gap-1">
          <TabsTrigger value="info" className="px-5 rounded-xl font-extrabold text-xs gap-2 data-[state=active]:bg-card data-[state=active]:shadow-xs cursor-pointer">
            <User size={15} />
            {t('Biodata')}
          </TabsTrigger>
          <TabsTrigger value="security" className="px-5 rounded-xl font-extrabold text-xs gap-2 data-[state=active]:bg-card data-[state=active]:shadow-xs cursor-pointer">
            <Lock size={15} />
            {t('Keamanan')}
          </TabsTrigger>
          <TabsTrigger value="activity" className="px-5 rounded-xl font-extrabold text-xs gap-2 data-[state=active]:bg-card data-[state=active]:shadow-xs cursor-pointer">
            <Activity size={15} />
            {t('Aktivitas')}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: BIODATA / INFORMASI PRIBADI */}
        <TabsContent value="info" className="w-full m-0 space-y-6 block">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/80 shadow-md rounded-3xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border/60 pb-4">
                <CardTitle className="text-base font-extrabold flex items-center gap-2">
                  <User size={18} className="text-emerald-600 dark:text-emerald-400" />
                  {t('Informasi Data Diri')}
                </CardTitle>
                <CardDescription className="text-xs font-medium">
                  {t('Perbarui nama lengkap dan pilihan bahasa antarmuka akun Anda')}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    {t('Nama Lengkap')}
                  </Label>
                  <Input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-xl bg-card border-border/80 font-bold text-sm focus-visible:ring-emerald-500/20"
                    placeholder={t('Masukkan nama lengkap Anda...')}
                  />
                  <p className="text-[11px] font-semibold text-muted-foreground">{t('Nama ini akan ditampilkan pada sistem dan laporan aktivitas.')}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    {t('Alamat Email (Pos-el)')}
                  </Label>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/60">
                    <span className="font-extrabold text-sm text-foreground">{email}</span>
                    <Badge variant="outline" className="text-[10px] font-bold bg-card text-muted-foreground border-border/60">
                      {t('Terkunci (Tidak Dapat Diubah)')}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    {t('Peran Pengguna (Hak Akses)')}
                  </Label>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/60">
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-emerald-600 dark:text-emerald-400" />
                      <span className="font-extrabold text-sm text-foreground">{roleLabels[userRole] || userRole}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold bg-card text-muted-foreground border-border/60">
                      {t('Dikelola oleh Administrator')}
                    </Badge>
                  </div>
                </div>

                {/* Interface Language Preference */}
                <div className="space-y-3 pt-2 border-t border-border/50">
                  <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Globe size={15} />
                    {t('Pilihan Bahasa Antarmuka')}
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={selectedLang === 'id' ? 'default' : 'outline'}
                      onClick={() => handleLanguageChange('id')}
                      className={cn(
                        "h-12 rounded-2xl font-extrabold text-xs gap-2 border-border/60 shadow-xs transition-all cursor-pointer",
                        selectedLang === 'id' ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20" : "hover:bg-muted"
                      )}
                    >
                      🇮🇩 Bahasa Indonesia
                    </Button>
                    <Button
                      type="button"
                      variant={selectedLang === 'en' ? 'default' : 'outline'}
                      onClick={() => handleLanguageChange('en')}
                      className={cn(
                        "h-12 rounded-2xl font-extrabold text-xs gap-2 border-border/60 shadow-xs transition-all cursor-pointer",
                        selectedLang === 'en' ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20" : "hover:bg-muted"
                      )}
                    >
                      🇬🇧 English
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* TAB 2: KEAMANAN AKUN */}
        <TabsContent value="security" className="w-full m-0 space-y-6 block">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/80 shadow-md rounded-3xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border/60 pb-4">
                <CardTitle className="text-base font-extrabold flex items-center gap-2">
                  <Key size={18} className="text-emerald-600 dark:text-emerald-400" />
                  {t('Pembaruan Kata Sandi')}
                </CardTitle>
                <CardDescription className="text-xs font-medium">
                  {t('Pastikan kata sandi Anda kuat untuk menjaga keamanan data perangkat IoT')}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-5">
                {/* Current Password */}
                <div className="space-y-2">
                  <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    {t('Kata Sandi Lama')}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="h-12 rounded-xl bg-card border-border/80 font-bold text-sm pr-11 focus-visible:ring-emerald-500/20"
                      placeholder={t('Masukkan kata sandi lama Anda di sini...')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    {t('Kata Sandi Baru')}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={!currentPassword}
                      className="h-12 rounded-xl bg-card border-border/80 font-bold text-sm pr-11 focus-visible:ring-emerald-500/20 disabled:opacity-50"
                      placeholder={t('Minimal 8 karakter (huruf, angka, simbol)...')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      disabled={!currentPassword}
                      className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  {newPassword && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-extrabold">
                        <span>{t('Kekuatan Kata Sandi:')}</span>
                        <span className={cn(
                          passwordStrength.score >= 100 ? "text-emerald-600 dark:text-emerald-400" :
                          passwordStrength.score >= 65 ? "text-amber-500" : "text-rose-500"
                        )}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div 
                          className={cn("h-full transition-all duration-300", passwordStrength.color)}
                          style={{ width: `${passwordStrength.score}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    {t('Konfirmasi Kata Sandi Baru')}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={!currentPassword}
                      className="h-12 rounded-xl bg-card border-border/80 font-bold text-sm pr-11 focus-visible:ring-emerald-500/20 disabled:opacity-50"
                      placeholder={t('Ulangi kata sandi baru Anda...')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={!currentPassword}
                      className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {confirmPassword && newPassword && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold mt-1">
                      {confirmPassword === newPassword ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={13} /> {t('Kata sandi cocok')}
                        </span>
                      ) : (
                        <span className="text-rose-500 flex items-center gap-1">
                          <AlertCircle size={13} /> {t('Kata sandi belum cocok')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* TAB 3: LOG AKTIVITAS */}
        <TabsContent value="activity" className="w-full m-0 space-y-6 block">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/80 shadow-md rounded-3xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border/60 pb-4">
                <CardTitle className="text-base font-extrabold flex items-center gap-2">
                  <Activity size={18} className="text-emerald-600 dark:text-emerald-400" />
                  {t('Log Aktivitas dan Sesi Masuk Terakhir')}
                </CardTitle>
                <CardDescription className="text-xs font-medium">
                  {t('Riwayat aktivitas sistem yang tercatat pada akun Anda')}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6">
                {isLoadingLogs ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-bold text-muted-foreground">{t('Memuat riwayat aktivitas...')}</p>
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Laptop size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-extrabold">{t('Belum ada riwayat aktivitas tercatat.')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activityLogs.map((log, idx) => (
                      <div 
                        key={log.id || idx}
                        className="p-3.5 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between gap-4 hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                            <Clock size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-foreground">{log.action || log.description}</p>
                            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                              {t('Modul:')} {log.module || 'Sistem'} • IP: {log.ip || '127.0.0.1'}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-bold bg-card border-border/60 shrink-0">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString(i18n.language === 'en' ? 'en-US' : 'id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : t('Terbaru')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Save Changes Button */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="pt-2 flex justify-end"
      >
        <Button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="rounded-2xl font-extrabold gap-2.5 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-lg shadow-emerald-600/25 w-full sm:w-auto sm:min-w-[220px] h-13 text-sm cursor-pointer"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Save size={18} />
          )}
          {isSaving ? t('Menyimpan Perubahan...') : t('Simpan Semua Perubahan')}
        </Button>
      </motion.div>
    </div>
  );
}
