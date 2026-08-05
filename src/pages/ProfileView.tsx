import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, Camera, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api from '../lib/api';
import { getStoredUser } from '../lib/storage';

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

export default function ProfileView({ user, userRole, onUpdateUser, onNavigateBack }: ProfileViewProps) {
  const { i18n } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(getFullUrl(user?.profile_photo || user?.photoURL) || null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedLang, setSelectedLang] = useState(user?.language || i18n.language || 'id');

  // Preview language instantly when selected
  useEffect(() => {
    if (selectedLang && selectedLang !== i18n.language) {
      i18n.changeLanguage(selectedLang);
    }
  }, [selectedLang, i18n]);

  // Revert language if navigating away without saving
  useEffect(() => {
    return () => {
      const savedLanguage = getStoredUser()?.language || 'id';
      if (savedLanguage && i18n.language !== savedLanguage) {
        i18n.changeLanguage(savedLanguage);
      }
    };
  }, [i18n]);

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    operator: 'Operator',
    viewer: 'Viewer / Pemantau'
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-rose-500/10 text-rose-600 border-rose-200',
    operator: 'bg-blue-500/10 text-blue-600 border-blue-200',
    viewer: 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran foto maksimal 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string);
      setProfilePhoto(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAll = async () => {
    if (!name.trim()) {
      toast.error('Nama tidak boleh kosong.');
      return;
    }
    
    const isPasswordAttempt = currentPassword || newPassword || confirmPassword;
    if (isPasswordAttempt) {
      if (!currentPassword) { toast.error('Masukkan password lama.'); return; }
      if (newPassword.length < 8) { toast.error('Password baru minimal 8 karakter.'); return; }
      if (newPassword !== confirmPassword) { toast.error('Konfirmasi password tidak cocok.'); return; }
    }

    setIsSaving(true);
    let profileUpdated = false;
    let passwordUpdated = false;
    let hasError = false;

    try {
      // 1. Update Profile if changed
      const isProfileChanged = name !== user?.name || profilePhoto || selectedLang !== (user?.language || i18n.language);
      
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
          onUpdateUser(updatedUser);
          setProfilePhoto(null);
          
          if (selectedLang !== i18n.language) {
            i18n.changeLanguage(selectedLang);
          }
          
          profileUpdated = true;
        }
      }

      // 2. Update Password if attempted
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
        toast.success('Profil dan password berhasil diperbarui!');
      } else if (profileUpdated) {
        toast.success('Profil berhasil diperbarui!');
      } else if (passwordUpdated) {
        toast.success('Password berhasil diperbarui!');
      } else if (!isPasswordAttempt && !isProfileChanged) {
        toast.info('Tidak ada perubahan yang disimpan.');
      }
    } catch (err: any) {
      hasError = true;
      const msg = err.response?.data?.message || 'Gagal menyimpan perubahan.';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onNavigateBack}
          className="rounded-xl gap-2 font-semibold"
        >
          <ArrowLeft size={16} />
          Kembali
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profil Saya</h1>
          <p className="text-muted-foreground text-sm">Kelola informasi akun Anda</p>
        </div>
      </div>

      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-none shadow-xl shadow-black/5 overflow-hidden">
          <CardContent className="p-6 relative z-10">
            {/* Avatar + Name Section */}
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-6 mb-8 border-b border-border/50 pb-6">
              <div className="relative group">
                {photoPreview ? (
                  <img 
                    src={photoPreview} 
                    alt="Avatar" 
                    className="w-24 h-24 rounded-2xl object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-muted/20 flex items-center justify-center p-2">
                    <img src="/user.png" alt="Default Avatar" className="w-full h-full object-cover rounded-xl" />
                  </div>
                )}
                <label className="absolute -bottom-2 -right-2 bg-background p-2 rounded-xl shadow-lg border cursor-pointer hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <Camera size={16} />
                  <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                </label>
              </div>
              <div className="flex-1 space-y-1">
                <h2 className="text-xl font-bold tracking-tight">{user?.name || 'Pengguna'}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-wider ${roleColors[userRole] || ''}`}>
                  {roleLabels[userRole] || userRole}
                </Badge>
              </div>
            </div>

            {/* Profile Info */}
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">
                  Nama Lengkap
                </Label>
                <Input 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-xl bg-muted/30 border-none font-medium focus-visible:ring-primary/20"
                  placeholder="Masukkan nama lengkap..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">
                  Email
                </Label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <span className="font-medium text-sm">{email}</span>
                  <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider">Tidak Dapat Diubah</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">
                  Peran / Role
                </Label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <span className="font-medium text-sm">{roleLabels[userRole] || userRole}</span>
                  <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider">Diatur Admin</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Preferences Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-none shadow-xl shadow-black/5">
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              Preferensi Bahasa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant={selectedLang === 'id' ? 'default' : 'outline'}
                  onClick={() => setSelectedLang('id')}
                  className={cn("flex-1 h-11 gap-2 rounded-xl border-border/50 shadow-sm", selectedLang === 'id' && "shadow-primary/20")}
                >
                  Indonesia
                </Button>
                <Button
                  variant={selectedLang === 'en' ? 'default' : 'outline'}
                  onClick={() => setSelectedLang('en')}
                  className={cn("flex-1 h-11 gap-2 rounded-xl border-border/50 shadow-sm", selectedLang === 'en' && "shadow-primary/20")}
                >
                  English
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Password Change Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border-none shadow-xl shadow-black/5">
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              Ubah Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Password Lama</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-11 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20"
                  placeholder="Masukkan password lama disini"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Password Baru</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20"
                  placeholder="Minimal 8 karakter"
                  disabled={!currentPassword}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Konfirmasi Password Baru</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20"
                  placeholder="Ulangi password baru"
                  disabled={!currentPassword}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Unified Save Button */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.3 }}
        className="flex justify-end pt-4"
      >
        <Button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="rounded-xl font-bold gap-2 shadow-lg shadow-primary/20 w-full sm:w-auto sm:min-w-[200px] h-12 text-base"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Save size={20} />
          )}
          {isSaving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}
        </Button>
      </motion.div>
    </div>
  );
}
