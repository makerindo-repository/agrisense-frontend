import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  Save, CheckCircle2, Eye, EyeOff, Building2, AlertTriangle, Radio,
  Mail, Send, Plus, Trash2, Copy, ExternalLink, ShieldCheck, Sparkles, Upload, Key, Cpu, Sliders
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import api from '../lib/api';
import { SystemSettings } from '../App';

export default function SettingsView({ settings, setSettings, userRole }: { settings: SystemSettings, setSettings: (s: SystemSettings) => void, userRole: string }) {
  const { t } = useTranslation();
  const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [newSubscriberEmail, setNewSubscriberEmail] = useState("");

  // Sync settings dari parent props saat polling jika belum ada unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) {
      setLocalSettings(settings);
    }
  }, [settings, hasUnsavedChanges]);

  // Helper update local settings
  const updateLocal = (patch: Partial<SystemSettings>) => {
    setLocalSettings(prev => ({ ...prev, ...patch }));
    setHasUnsavedChanges(true);
  };

  // Simpan Pengaturan ke Backend (POST /api/settings)
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payloadToSave = {
        ...localSettings,
        co2Threshold: localSettings.co2Threshold === '' ? 0 : Number(localSettings.co2Threshold),
        tempMax: localSettings.tempMax === '' ? 0 : Number(localSettings.tempMax),
        humidityMin: localSettings.humidityMin === '' ? 0 : Number(localSettings.humidityMin),
        samplingInterval: localSettings.samplingInterval === '' ? 0 : Number(localSettings.samplingInterval),
      };

      const res = await api.post('/settings', payloadToSave);
      if (res.data?.status === 'success') {
        setSettings(payloadToSave);
        setHasUnsavedChanges(false);
        setShowSuccess(true);
        toast.success(t('Pengaturan berhasil disimpan!'));
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        toast.error(t('Gagal menyimpan pengaturan. Silakan coba lagi.'));
      }
    } catch (err: any) {
      console.error("Gagal menyimpan pengaturan:", err);
      const msg = err.response?.data?.message || err.message || 'Terjadi kesalahan server.';
      toast.error(t('Gagal menyimpan: ') + msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Uji Coba Pengiriman Email Notifikasi (POST /api/settings/test-email)
  const handleTestEmail = async () => {
    setIsSendingTestEmail(true);
    try {
      const res = await api.post('/settings/test-email', { email: localSettings.notificationEmails });
      if (res.data?.status === 'success' || res.status === 200) {
        toast.success(t('Email uji coba berhasil dikirim ke penerima!'));
      } else {
        toast.error(t('Gagal mengirim email uji coba. Periksa konfigurasi SMTP.'));
      }
    } catch (err: any) {
      console.error("Gagal mengirim test email:", err);
      const msg = err.response?.data?.message || err.message || 'Gagal mengirim email test.';
      toast.error(msg);
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleLogoChange = () => {
    logoInputRef.current?.click();
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error(t('Format file tidak didukung. Gunakan PNG, JPG, atau WebP.'));
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error(t('Ukuran file terlalu besar. Maksimal 1MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLogoPreview(dataUrl);
      updateLocal({ appLogo: dataUrl });
      toast.success(t('Logo berhasil dimuat! Klik "Simpan Semua Perubahan" untuk menerapkan.'));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full space-y-8 max-w-5xl mx-auto pb-24 select-none">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs shrink-0">
            <Sliders size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              {t('Pengaturan Sistem')}
            </h1>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {t('Konfigurasi global infrastruktur dan ambang batas telemetri AgriSense')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-500/10 px-3.5 py-2 rounded-xl border border-emerald-500/20"
            >
              <CheckCircle2 size={16} />
              {t('Perubahan Disimpan!')}
            </motion.div>
          )}

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-2xl font-extrabold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 px-6 h-12 text-xs cursor-pointer"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save size={17} />
            )}
            {isSaving ? t('Menyimpan Perubahan...') : t('Simpan Semua Perubahan')}
          </Button>
        </div>
      </div>

      {/* Grid 4 Kartu Pengaturan Utama */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 1. Profil dan Identitas Sistem */}
        <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden flex flex-col h-full">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Building2 size={20} />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold text-foreground tracking-tight">
                  {t('Profil dan Identitas Sistem')}
                </CardTitle>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  {t('Atur nama platform, logo instansi, dan parameter identitas utama')}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-5 flex-1 flex flex-col justify-start">
            <div className="space-y-2">
              <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {t('Logo Aplikasi')}
              </Label>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-dashed border-border/80">
                <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0 overflow-hidden shadow-sm border border-border/60">
                  {(logoPreview || localSettings.appLogo) ? (
                    <img src={logoPreview || localSettings.appLogo} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                  ) : (
                    <Building2 size={28} />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {t('Format: PNG, JPG, WebP. Ukuran rekomendasi: 512x512px (Maks. 1MB)')}
                  </p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoFileSelect}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleLogoChange} 
                    className="rounded-xl h-9 text-xs font-extrabold gap-1.5 cursor-pointer"
                  >
                    <Upload size={14} />
                    {t('Ganti Logo')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {t('Nama Platform / Aplikasi')}
              </Label>
              <Input
                value={localSettings.appName}
                onChange={(e) => updateLocal({ appName: e.target.value })}
                className="h-11 rounded-2xl bg-card border-border/80 font-bold text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. Ambang Batas Peringatan Telemetri */}
        <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden flex flex-col h-full">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold text-foreground tracking-tight">
                  {t('Ambang Batas Peringatan Telemetri')}
                </CardTitle>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  {t('Batas batas aman parameter lingkungan untuk pemicu notifikasi anomali')}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-start">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{t('Sistem akan otomatis mengevaluasi kondisi sensor setiap interval sampling.')}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 flex flex-col justify-end">
                <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground min-h-[32px] flex items-end pb-1">
                  {t('Batas Maksimum CO₂')}
                </Label>
                <div className="relative flex items-center">
                  <Input
                    type="number"
                    value={localSettings.co2Threshold}
                    onChange={(e) => updateLocal({ co2Threshold: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="h-11 rounded-2xl bg-card border-border/80 font-bold text-sm pr-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-3 text-[11px] font-black text-muted-foreground/80 bg-muted/70 px-2 py-0.5 rounded-lg border border-border/50 pointer-events-none select-none">
                    PPM
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground min-h-[32px] flex items-end pb-1">
                  {t('Suhu Udara Maksimum')}
                </Label>
                <div className="relative flex items-center">
                  <Input
                    type="number"
                    value={localSettings.tempMax}
                    onChange={(e) => updateLocal({ tempMax: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="h-11 rounded-2xl bg-card border-border/80 font-bold text-sm pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-3 text-[11px] font-black text-muted-foreground/80 bg-muted/70 px-2 py-0.5 rounded-lg border border-border/50 pointer-events-none select-none">
                    °C
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground min-h-[32px] flex items-end pb-1">
                  {t('Kelembapan Udara Minimum')}
                </Label>
                <div className="relative flex items-center">
                  <Input
                    type="number"
                    value={localSettings.humidityMin}
                    onChange={(e) => updateLocal({ humidityMin: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="h-11 rounded-2xl bg-card border-border/80 font-bold text-sm pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-3 text-[11px] font-black text-muted-foreground/80 bg-muted/70 px-2 py-0.5 rounded-lg border border-border/50 pointer-events-none select-none">
                    %
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground min-h-[32px] flex items-end pb-1">
                  {t('Interval Transmisi Data')}
                </Label>
                <div className="relative flex items-center">
                  <Input
                    type="number"
                    value={localSettings.samplingInterval}
                    onChange={(e) => updateLocal({ samplingInterval: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="h-11 rounded-2xl bg-card border-border/80 font-bold text-sm pr-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-3 text-[11px] font-black text-muted-foreground/80 bg-muted/70 px-2 py-0.5 rounded-lg border border-border/50 pointer-events-none select-none">
                    detik
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Konektivitas MQTT Broker dan AI Engine */}
        <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden flex flex-col h-full">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
                <Radio size={20} />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold text-foreground tracking-tight">
                  {t('Konektivitas MQTT Broker dan AI Engine')}
                </CardTitle>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  {t('Pengaturan alamat server broker MQTT dan API Key Kecerdasan Buatan')}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-start">
            <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-400 text-xs font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Radio size={15} className="shrink-0 animate-pulse" />
                Topik Telemetri: <code className="font-mono text-[11px] bg-background/50 px-2 py-0.5 rounded-md">agrisense/iot/readings</code>
              </span>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Active</Badge>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {t('URL MQTT Broker')}
              </Label>
              <Input
                value={localSettings.mqttUrl}
                onChange={(e) => updateLocal({ mqttUrl: e.target.value })}
                className="h-11 rounded-2xl bg-card border-border/80 font-bold text-sm font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {t('API Key Mesin AI (Google AI Studio)')}
              </Label>
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={localSettings.aiEngineKey}
                  onChange={(e) => updateLocal({ aiEngineKey: e.target.value })}
                  className="h-11 rounded-2xl bg-card border-border/80 font-bold text-sm font-mono flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="h-11 rounded-2xl px-4 text-xs font-extrabold gap-1.5 cursor-pointer"
                >
                  {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  {showApiKey ? t('Sembunyikan') : t('Tampilkan')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Notifikasi Peringatan dan Integrasi */}
        <Card className="bg-card border-border/80 shadow-md rounded-3xl overflow-hidden flex flex-col h-full">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                <Mail size={20} />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold text-foreground tracking-tight">
                  {t('Notifikasi Peringatan dan Integrasi')}
                </CardTitle>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  {t('Pengaturan jalur pengiriman notifikasi otomatis via Pos-el dan Telegram')}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            {/* Email Alert Toggle */}
            <div
              className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/60 transition-colors"
              onClick={() => updateLocal({ emailAlert: !localSettings.emailAlert })}
            >
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-foreground">{t('Notifikasi Pos-el (Email Alert)')}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{t('Kirim pesan peringatan ke admin saat sensor mendeteksi anomali')}</span>
              </div>
              <div className={cn(
                "w-11 h-6 rounded-full relative transition-colors p-0.5",
                localSettings.emailAlert ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
              )}>
                <motion.div
                  animate={{ x: localSettings.emailAlert ? 20 : 0 }}
                  className="w-5 h-5 bg-white rounded-full shadow-sm"
                />
              </div>
            </div>

            {/* Telegram Bot Toggle */}
            <div
              className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/60 transition-colors"
              onClick={() => updateLocal({ telegramBot: !localSettings.telegramBot })}
            >
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-foreground">{t('Bot Telegram')}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{t('Integrasi laporan dan notifikasi otomatis via Telegram Bot')}</span>
              </div>
              <div className={cn(
                "w-11 h-6 rounded-full relative transition-colors p-0.5",
                localSettings.telegramBot ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
              )}>
                <motion.div
                  animate={{ x: localSettings.telegramBot ? 20 : 0 }}
                  className="w-5 h-5 bg-white rounded-full shadow-sm"
                />
              </div>
            </div>

            {/* Telegram Invite Link Input */}
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{t('Tautan Undangan Saluran Telegram')}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://t.me/+AbCdEfG"
                  value={localSettings.telegramInviteLink || ''}
                  onChange={(e) => updateLocal({ telegramInviteLink: e.target.value })}
                  className="h-10 rounded-2xl bg-card border-border/80 font-bold text-xs flex-1"
                />
                <Button 
                  variant="outline" 
                  className="h-10 px-3.5 rounded-2xl border-border/60 hover:bg-muted cursor-pointer"
                  onClick={() => {
                    if (localSettings.telegramInviteLink) {
                      navigator.clipboard.writeText(localSettings.telegramInviteLink);
                      toast.success(t("Tautan disalin ke clipboard!"));
                    } else {
                      toast.error(t("Tautan kosong!"));
                    }
                  }}
                  title={t('Salin Tautan')}
                >
                  <Copy size={15} />
                </Button>
                <Button 
                  variant="secondary" 
                  className="h-10 px-3.5 rounded-2xl cursor-pointer"
                  onClick={() => {
                    if (localSettings.telegramInviteLink) {
                      window.open(localSettings.telegramInviteLink, "_blank");
                    } else {
                      toast.error(t("Tautan kosong!"));
                    }
                  }}
                  title={t('Buka Tautan')}
                >
                  <ExternalLink size={15} />
                </Button>
              </div>
            </div>

            {/* Email Subscriber List */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {t('Daftar Pos-el (Email) Penerima Notifikasi')}
              </Label>
              <p className="text-[10px] text-muted-foreground font-medium">
                {t('Email terdaftar akan menerima pesan notifikasi darurat saat node offline')}
              </p>

              <div className="flex gap-2">
                <Input
                  placeholder={t('Masukkan alamat pos-el (email)...')}
                  value={newSubscriberEmail}
                  onChange={(e) => setNewSubscriberEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!newSubscriberEmail || !newSubscriberEmail.includes('@')) return;
                      const current: string[] = localSettings.notificationEmails ? JSON.parse(localSettings.notificationEmails) : [];
                      if (current.includes(newSubscriberEmail)) { toast.error(t('Email sudah terdaftar.')); return; }
                      const updated = [...current, newSubscriberEmail];
                      updateLocal({ notificationEmails: JSON.stringify(updated) });
                      setNewSubscriberEmail("");
                    }
                  }}
                  className="h-10 rounded-2xl bg-card border-border/80 font-bold text-xs flex-1"
                />
                <Button
                  variant="secondary"
                  className="h-10 rounded-2xl font-extrabold px-4 text-xs cursor-pointer"
                  onClick={() => {
                    if (!newSubscriberEmail || !newSubscriberEmail.includes('@')) { toast.error(t('Masukkan email yang valid.')); return; }
                    const current: string[] = localSettings.notificationEmails ? JSON.parse(localSettings.notificationEmails) : [];
                    if (current.includes(newSubscriberEmail)) { toast.error(t('Email sudah terdaftar.')); return; }
                    const updated = [...current, newSubscriberEmail];
                    updateLocal({ notificationEmails: JSON.stringify(updated) });
                    setNewSubscriberEmail("");
                  }}
                >
                  <Plus size={15} className="mr-1" /> {t('Tambah Email')}
                </Button>
              </div>

              {/* Subscriber List Chips */}
              {(() => {
                const emails: string[] = localSettings.notificationEmails ? JSON.parse(localSettings.notificationEmails) : [];
                if (emails.length === 0) return <p className="text-[10px] text-muted-foreground font-medium italic pt-1">{t('Belum ada email terdaftar. Notifikasi dikirim ke seluruh admin.')}</p>;
                return (
                  <div className="space-y-1.5 mt-2">
                    {emails.map((email, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/50">
                        <span className="text-xs font-bold text-foreground">{email}</span>
                        <Button
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 cursor-pointer"
                          onClick={() => {
                            const updated = emails.filter((_, i) => i !== idx);
                            updateLocal({ notificationEmails: JSON.stringify(updated) });
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
